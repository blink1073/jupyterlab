// Copyright (c) Jupyter Development Team.
// Distributed under the terms of the Modified BSD License.

import {
  ILayoutRestorer, JupyterLab, JupyterLabPlugin
} from '@jupyterlab/application';

import {
  Dialog, ICommandPalette, IMainMenu, InstanceTracker, showDialog
} from '@jupyterlab/apputils';

import {
  IEditorServices
} from '@jupyterlab/codeeditor';

import {
  ConsolePanel, IConsoleTracker, CodeConsole
} from '@jupyterlab/console';

import {
  PageConfig, ISettingRegistry
} from '@jupyterlab/coreutils';

import {
  ILauncher
} from '@jupyterlab/launcher';

import {
  find, each
} from '@phosphor/algorithm';

import {
  ReadonlyJSONObject
} from '@phosphor/coreutils';

import {
  Menu
} from '@phosphor/widgets';


/**
 * The command IDs used by the console plugin.
 */
namespace CommandIDs {
  export
  const create = 'console:create';

  export
  const clear = 'console:clear';

  export
  const run = 'console:run';

  export
  const runForced = 'console:run-forced';

  export
  const linebreak = 'console:linebreak';

  export
  const interrupt = 'console:interrupt-kernel';

  export
  const restart = 'console:restart-kernel';

  export
  const closeAndShutdown = 'console:close-and-shutdown';

  export
  const open = 'console:open';

  export
  const inject = 'console:inject';

  export
  const changeKernel = 'console:change-kernel';

  export
  const exportNotebook = 'console:export-notebook';
}


/**
 * The console widget tracker provider.
 */
const tracker: JupyterLabPlugin<IConsoleTracker> = {
  id: '@jupyterlab/console-extension:tracker',
  provides: IConsoleTracker,
  requires: [
    IMainMenu,
    ICommandPalette,
    ConsolePanel.IContentFactory,
    IEditorServices,
    ISettingRegistry,
    ILayoutRestorer
  ],
  optional: [ILauncher],
  activate: activateConsole,
  autoStart: true
};


/**
 * The console widget content factory.
 */
const factory: JupyterLabPlugin<ConsolePanel.IContentFactory> = {
  id: '@jupyterlab/console-extension:factory',
  provides: ConsolePanel.IContentFactory,
  requires: [IEditorServices],
  autoStart: true,
  activate: (app: JupyterLab, editorServices: IEditorServices) => {
    const editorFactory = editorServices.factoryService.newInlineEditor
      .bind(editorServices.factoryService);
    return new ConsolePanel.ContentFactory({ editorFactory });
  }
};


/**
 * Export the plugins as the default.
 */
const plugins: JupyterLabPlugin<any>[] = [factory, tracker];
export default plugins;


/**
 * Activate the console extension.
 */
function activateConsole(app: JupyterLab, mainMenu: IMainMenu, palette: ICommandPalette, contentFactory: ConsolePanel.IContentFactory,  editorServices: IEditorServices, settingRegistry: ISettingRegistry, restorer: ILayoutRestorer, launcher: ILauncher | null): IConsoleTracker {
  const id = plugins[1].id;
  let manager = app.serviceManager;
  let { commands, shell } = app;
  let category = 'Console';
  let command: string;
  let menu = new Menu({ commands });

  // Create an instance tracker for all console panels.
  const tracker = new InstanceTracker<ConsolePanel>({ namespace: 'console' });

  let {
    fileBacking
  } = CodeConsole.defaultConfig;

  // Handle state restoration.
  restorer.restore(tracker, {
    command: CommandIDs.open,
    args: panel => ({
      path: panel.console.session.path,
      name: panel.console.session.name
    }),
    name: panel => panel.console.session.path,
    when: manager.ready
  });

  /**
   * Update the setting values.
   */
  function updateSettings(settings: ISettingRegistry.ISettings): void {
    let cached = settings.get('fileBacking').composite as boolean | null;
    fileBacking = cached === null ? fileBacking : !!cached;
    CodeConsole.setOption('fileBacking', fileBacking);
  }

  // Fetch the initial state of the settings.
  Promise.all([settingRegistry.load(id), shell]).then(([settings]) => {
    updateSettings(settings);
    settings.changed.connect(() => {
      updateSettings(settings);
    });
  }).catch((reason: Error) => {
    console.error(reason.message);
  });

  // Update the command registry when the console state changes.
  tracker.currentChanged.connect(() => {
    if (tracker.size <= 1) {
      commands.notifyCommandChanged(CommandIDs.interrupt);
    }
  });

  // The launcher callback.
  let callback = (cwd: string, name: string) => {
    return createConsole({ basePath: cwd, kernelPreference: { name } });
  };

  // Update console count to reflect number of running consoles.
  manager.ready.then(() => {
    let count = 1;
    each(manager.sessions.running(), model => {
      if (model.type === 'console') {
        count += 1;
      }
    });
    ConsolePanel.setConsoleCount(count);
  });

  // Add a launcher item if the launcher is available.
  if (launcher) {
    manager.ready.then(() => {
      const specs = manager.specs;
      if (!specs) {
        return;
      }
      let baseUrl = PageConfig.getBaseUrl();
      for (let name in specs.kernelspecs) {
        let displayName = specs.kernelspecs[name].display_name;
        let rank = name === specs.default ? 0 : Infinity;
        let kernelIconUrl = specs.kernelspecs[name].resources['logo-64x64'];
        if (kernelIconUrl) {
          let index = kernelIconUrl.indexOf('kernelspecs');
          kernelIconUrl = baseUrl + kernelIconUrl.slice(index);
        }
        launcher.add({
          displayName,
          category: 'Console',
          name,
          iconClass: 'jp-CodeConsoleIcon',
          callback,
          rank,
          kernelIconUrl
        });
      }
    });
  }

  // Set the main menu title.
  menu.title.label = category;

  /**
   * Create a console for a given path.
   */
  function createConsole(options: Partial<ConsolePanel.IOptions>): Promise<ConsolePanel> {
    return manager.ready.then(() => {
      let panel = new ConsolePanel({
        manager,
        rendermime: app.rendermime.clone(),
        contentFactory,
        mimeTypeService: editorServices.mimeTypeService,
        ...options
      });

      // Add the console panel to the tracker.
      tracker.add(panel);
      shell.addToMainArea(panel);
      shell.activateById(panel.id);
      return panel;
    });
  }

  /**
   * Whether there is an active console.
   */
  function hasWidget(): boolean {
    return tracker.currentWidget !== null;
  }

  command = CommandIDs.open;
  commands.addCommand(command, {
    execute: (args: Partial<ConsolePanel.IOptions>) => {
      let path = args['path'];
      let widget = tracker.find(value => {
        return value.console.session.path === path;
      });
      if (widget) {
        shell.activateById(widget.id);
      } else {
        return manager.ready.then(() => {
          let model = find(manager.sessions.running(), item => {
            return item.path === path;
          });
          if (model) {
            // The name in args is not the name of the console,
            // which is what ConsolePanel expects.
            if (!args.name || !args.name.length) {
              args.name = model.name;
            }
            return createConsole(args);
          }
          return Promise.reject(`No running console for path: ${path}`);
        });
      }
    },
  });

  command = CommandIDs.create;
  commands.addCommand(command, {
    label: 'Start New Console',
    execute: (args: Partial<ConsolePanel.IOptions>) => {
      let basePath = args.basePath || '.';
      return createConsole({ basePath, ...args });
    }
  });
  palette.addItem({ command, category });

  // Get the current widget and activate unless the args specify otherwise.
  function getCurrent(args: ReadonlyJSONObject): ConsolePanel | null {
    let widget = tracker.currentWidget;
    let activate = args['activate'] !== false;
    if (activate && widget) {
      shell.activateById(widget.id);
    }
    return widget;
  }

  command = CommandIDs.clear;
  commands.addCommand(command, {
    label: 'Clear Cells',
    execute: args => {
      let current = getCurrent(args);
      if (!current) {
        return;
      }
      current.console.clear();
    },
    isEnabled: hasWidget
  });
  palette.addItem({ command, category });

  command = CommandIDs.run;
  commands.addCommand(command, {
    label: 'Run Cell',
    execute: args => {
      let current = getCurrent(args);
      if (!current) {
        return;
      }
      return current.console.execute();
    },
    isEnabled: hasWidget
  });
  palette.addItem({ command, category });

  command = CommandIDs.runForced;
  commands.addCommand(command, {
    label: 'Run Cell (forced)',
    execute: args => {
      let current = getCurrent(args);
      if (!current) {
        return;
      }
      current.console.execute(true);
    },
    isEnabled: hasWidget
  });
  palette.addItem({ command, category });

  command = CommandIDs.linebreak;
  commands.addCommand(command, {
    label: 'Insert Line Break',
    execute: args => {
      let current = getCurrent(args);
      if (!current) {
        return;
      }
      current.console.insertLinebreak();
    },
    isEnabled: hasWidget
  });
  palette.addItem({ command, category });

  command = CommandIDs.interrupt;
  commands.addCommand(command, {
    label: 'Interrupt Kernel',
    execute: args => {
      let current = getCurrent(args);
      if (!current) {
        return;
      }
      let kernel = current.console.session.kernel;
      if (kernel) {
        return kernel.interrupt();
      }
    },
    isEnabled: hasWidget
  });
  palette.addItem({ command, category });

  command = CommandIDs.restart;
  commands.addCommand(command, {
    label: 'Restart Kernel',
    execute: args => {
      let current = getCurrent(args);
      if (!current) {
        return;
      }
      return current.console.session.restart();
    },
    isEnabled: hasWidget
  });
  palette.addItem({ command, category });

  command = CommandIDs.closeAndShutdown;
  commands.addCommand(command, {
    label: 'Close and Shutdown',
    execute: args => {
      const current = getCurrent(args);
      if (!current) {
        return;
      }
      return showDialog({
        title: 'Shutdown the console?',
        body: `Are you sure you want to close "${current.title.label}"?`,
        buttons: [Dialog.cancelButton(), Dialog.warnButton()]
      }).then(result => {
        if (result.button.accept) {
          current.console.session.shutdown().then(() => {
            current.dispose();
          });
        } else {
          return false;
        }
      });
    },
    isEnabled: hasWidget
  });

  command = CommandIDs.inject;
  commands.addCommand(command, {
    execute: args => {
      let path = args['path'];
      tracker.find(widget => {
        if (widget.console.session.path === path) {
          if (args['activate'] !== false) {
            shell.activateById(widget.id);
          }
          widget.console.inject(args['code'] as string);
          return true;
        }
        return false;
      });
    },
    isEnabled: hasWidget
  });

  command = CommandIDs.changeKernel;
  commands.addCommand(command, {
    label: 'Change Kernel',
    execute: args => {
      let current = getCurrent(args);
      if (!current) {
        return;
      }
      return current.console.session.selectKernel();
    },
    isEnabled: hasWidget
  });
  palette.addItem({ command, category });

  command = CommandIDs.exportNotebook;
  commands.addCommand(command, {
    label: 'Export to Notebook',
    execute: args => {
      const current = getCurrent(args);
      if (!current) {
        return;
      }
      let dir = current.session.path.substring(0, current.session.path.lastIndexOf('/'));
      return current.console.manager.contents.newUntitled({type: 'notebook', path: dir}).then(data => {
        if (!data) {
          return;
        }
        return current.console.save(data.path).then(() => {
          return commands.execute('docmanager:open', {
            path: data.path, factory: 'Notebook',
            kernel: { name }
          });
        });
      });
    },
    isEnabled: hasWidget
  });
  palette.addItem({ command, category });

  menu.addItem({ command: CommandIDs.run });
  menu.addItem({ command: CommandIDs.runForced });
  menu.addItem({ command: CommandIDs.linebreak });
  menu.addItem({ type: 'separator' });
  menu.addItem({ command: CommandIDs.clear });
  menu.addItem({ type: 'separator' });
  menu.addItem({ command: CommandIDs.interrupt });
  menu.addItem({ command: CommandIDs.restart });
  menu.addItem({ command: CommandIDs.changeKernel });
  menu.addItem({ type: 'separator' });
  menu.addItem({ command: CommandIDs.closeAndShutdown });
  menu.addItem({ type: 'separator' });
  menu.addItem({ command: CommandIDs.exportNotebook });

  mainMenu.addMenu(menu, {rank: 50});

  app.contextMenu.addItem({command: CommandIDs.clear, selector: '.jp-CodeConsole'});
  app.contextMenu.addItem({command: CommandIDs.restart, selector: '.jp-CodeConsole'});

  return tracker;
}
