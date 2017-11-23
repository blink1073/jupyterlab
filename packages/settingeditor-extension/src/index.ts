/*-----------------------------------------------------------------------------
| Copyright (c) Jupyter Development Team.
| Distributed under the terms of the Modified BSD License.
|----------------------------------------------------------------------------*/

import {
  ILayoutRestorer, JupyterLab, JupyterLabPlugin
} from '@jupyterlab/application';

import {
  InstanceTracker
} from '@jupyterlab/apputils';

import {
  IEditorServices
} from '@jupyterlab/codeeditor';

import {
  ISettingRegistry, IStateDB
} from '@jupyterlab/coreutils';

import {
  ISettingEditorTracker, SettingEditor
} from '@jupyterlab/settingeditor';


/**
 * The command IDs used by the setting editor.
 */
namespace CommandIDs {
  export
  const debug = 'settingeditor:debug';

  export
  const open = 'settingeditor:open';

  export
  const revert = 'settingeditor:revert';

  export
  const save = 'settingeditor:save';
}


/**
 * The default setting editor extension.
 */
const plugin: JupyterLabPlugin<ISettingEditorTracker> = {
  id: '@jupyterlab/settingeditor-extension:plugin',
  activate: (app: JupyterLab, restorer: ILayoutRestorer, registry: ISettingRegistry, editorServices: IEditorServices, state: IStateDB) => {
    const { commands, shell } = app;
    const namespace = 'setting-editor';
    const factoryService = editorServices.factoryService;
    const editorFactory = factoryService.newInlineEditor.bind(factoryService);
    const tracker = new InstanceTracker<SettingEditor>({ namespace });
    let editor: SettingEditor;

    // Handle state restoration.
    restorer.restore(tracker, {
      command: CommandIDs.open,
      args: widget => ({ }),
      name: widget => namespace
    });

    commands.addCommand(CommandIDs.debug, {
      execute: () => { console.log('debug'); },
      iconClass: 'jp-MaterialIcon jp-BugIcon',
      label: 'Debug user settings in inspector',
      isVisible: () => tracker.currentWidget.canDebugRaw
    });

    commands.addCommand(CommandIDs.open, {
      execute: () => {
        if (tracker.currentWidget) {
          shell.activateById(tracker.currentWidget.id);
          return;
        }

        const key = plugin.id;
        const when = app.restored;

        editor = new SettingEditor({
          commands: {
            registry: commands,
            debug: CommandIDs.debug,
            revert: CommandIDs.revert,
            save: CommandIDs.save
          },
          editorFactory, key, registry, state, when
        });

        // Notify the command registry when the visibility status of the setting
        // editor's commands change. The setting editor toolbar listens for this
        // signal from the command registry.
        editor.commandsChanged.connect((sender: any, args: string[]) => {
          args.forEach(id => { commands.notifyCommandChanged(id); });
        });

        tracker.add(editor);
        editor.id = namespace;
        editor.title.label = 'Settings';
        editor.title.iconClass = 'jp-SettingsIcon';
        editor.title.closable = true;
        shell.addToMainArea(editor);
        shell.activateById(editor.id);
      },
      label: 'Settings'
    });

    commands.addCommand(CommandIDs.revert, {
      execute: () => { console.log('revert'); },
      iconClass: 'jp-MaterialIcon jp-RefreshIcon',
      label: 'Revert user settings',
      isVisible: () => tracker.currentWidget.canRevertRaw
    });

    commands.addCommand(CommandIDs.save, {
      execute: () => { console.log('save'); },
      iconClass: 'jp-MaterialIcon jp-SaveIcon',
      label: 'Save user settings',
      isVisible: () => tracker.currentWidget.canSaveRaw
    });

    return tracker;
  },
  requires: [ILayoutRestorer, ISettingRegistry, IEditorServices, IStateDB],
  autoStart: true,
  provides: ISettingEditorTracker
};

export default plugin;
