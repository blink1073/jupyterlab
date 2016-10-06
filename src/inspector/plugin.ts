// Copyright (c) Jupyter Development Team.
// Distributed under the terms of the Modified BSD License.


import {
  JupyterLab, JupyterLabPlugin
} from '../application';

import {
  ICommandPalette
} from '../commandpalette';

import {
  IInspector, Inspector
} from './';



/**
 * A service providing an inspector panel.
 */
export
const inspectorProvider: JupyterLabPlugin<IInspector> = {
  id: 'jupyter.services.inspector',
  requires: [ICommandPalette],
  provides: IInspector,
  activate: activateInspector
};


/**
 * A class that manages inspector widget instances and offers persistent
 * `IInspector` instance that other plugins can communicate with.
 */
class InspectorManager implements IInspector {
  /**
   * The current inspector widget.
   */
  get inspector(): Inspector {
    return this._inspector;
  }
  set inspector(inspector: Inspector) {
    if (this._inspector === inspector) {
      return;
    }
    this._inspector = inspector;
  }

  /**
   * The source of events the inspector panel listens for.
   */
  get source(): Inspector.IInspectable {
    if (this._inspector && !this._inspector.isDisposed) {
      return this._inspector.source;
    }
    return null;
  }
  set source(source: Inspector.IInspectable) {
    if (this._inspector && !this._inspector.isDisposed) {
      this._inspector.source = source;
    }
  }

  private _inspector: Inspector = null;
}


/**
 * Activate the console extension.
 */
function activateInspector(app: JupyterLab, palette: ICommandPalette): IInspector {
  let manager = new InspectorManager();
  let openInspectorCommand = 'inspector:open';

  function newInspector(): Inspector {
    let inspector = new Inspector({ items: Private.defaultInspectorItems });
    inspector.id = 'jp-inspector';
    inspector.title.label = 'Inspector';
    inspector.title.closable = true;
    inspector.disposed.connect(() => {
      if (manager.inspector === inspector) {
        manager.inspector = null;
      }
    });
    return inspector;
  }

  function openInspector(): void {
    if (!manager.inspector || manager.inspector.isDisposed) {
      manager.inspector = newInspector();
      app.shell.addToMainArea(manager.inspector);
      return;
    }
    if (manager.inspector.isAttached) {
      app.shell.activateMain(manager.inspector.id);
      return;
    }
    console.log(manager.inspector);
  }

  app.commands.addCommand(openInspectorCommand, {
    execute: openInspector,
    label: 'Open Inspector'
  });

  palette.addItem({
    command: openInspectorCommand,
    category: 'Inspector'
  });

  return manager;
}

/**
 * A namespace for private data.
 */
namespace Private {
  /**
   * The default set of inspector items added to the inspector panel.
   */
  export
  const defaultInspectorItems: Inspector.IInspectorItem[] = [
    {
      className: 'jp-HintsInspectorItem',
      name: 'Hints',
      rank: 20,
      type: 'hints'
    }
  ];
}
