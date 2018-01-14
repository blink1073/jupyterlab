// Copyright (c) Jupyter Development Team.
// Distributed under the terms of the Modified BSD License.

import {
  Contents, ServiceManager, ServerConnection
} from '@jupyterlab/services';

import {
  JSONValue
} from '@phosphor/coreutils';

import {
  IDisposable, DisposableDelegate
} from '@phosphor/disposable';

import {
  ISignal, Signal
} from '@phosphor/signaling';

import {
  Widget
} from '@phosphor/widgets';

import {
  showDialog, ClientSession, Dialog, IClientSession
} from '@jupyterlab/apputils';

import {
  PathExt
} from '@jupyterlab/coreutils';

import {
  RenderMimeRegistry
} from '@jupyterlab/rendermime';

import {
  IRenderMime
} from '@jupyterlab/rendermime-interfaces';

import {
  DocumentRegistry
} from './registry';


/**
 * Create a document model.
 */
export
function createModel<T extends DocumentRegistry.IModel>(options: createModel.IOptions): Promise<T> {
  const { manager, factory, path } = options;
  const localPath = manager.localPath(path);
  const dbFactory = manager.getModelDBFactory(path);
  let lang = factory.preferredLanguage(PathExt.basename(localPath));
  let model: DocumentRegistry.IModel;

  if (dbFactory) {
    model = factory.createNew(lang, dbFactory.createNew(localPath));
  } else {
    model = factory.createNew(lang);
  }
  let modelDB = model.modelDB;
  return modelDB.connected.then(() => {
    if (modelDB.isPrepopulated) {
      return Private.saveModel(manager, factory, model, path);
    }
  }).then(() => {
    if (!modelDB.isPrepopulated) {
      return Private.loadModel(manager, factory, model, path);
    }
  }).then(() => {
    return model as T;
  });
}


/**
 * The namespace for `createModel` associated interfaces.
 */
export
namespace createModel {
  /**
   * The options used to create a model.
   */
  export
  interface IOptions {
    /**
     * The contents manager for the model.
     */
    manager: Contents.IManager;

    /**
     * The model factory for the model.
     */
    factory: DocumentRegistry.IModelFactory;

    /**
     * The path for the model.
     */
    path: string;
  }
}


/**
 * Create a document context.
 */
export
function createContext<T extends DocumentRegistry.IModel>(options: createContext.IOptions<T>): Promise<DocumentRegistry.IContext<T>> {
  return options.manager.ready.then(() => {
    return options.manager.contents.get(options.path, { content: false });
  }).then(contentsModel => {
    return new Private.Context({ ...options, contentsModel });
  });
}


/**
 * The namespace for `createContext` associated interfaces.
 */
export
namespace createContext {
  /**
   * The options used to create a model.
   */
  export
  interface IOptions<T extends DocumentRegistry.IModel> {
    /**
     * The services manager for the context.
     */
    manager: ServiceManager.IManager;

    /**
     * The model factory for the context.
     */
    factory: DocumentRegistry.IModelFactory<T>;

    /**
     * The path for the context.
     */
    path: string;

    /**
     * The model for the context.
     */
    model: T;

    /**
     * The kernel preference associated with the context.
     */
    kernelPreference?: IClientSession.IKernelPreference;

    /**
     * An optional callback for opening sibling widgets.
     */
    opener?: (widget: Widget, options?: DocumentRegistry.IOpenOptions) => void;
  }
}


/**
 * A namespace for private data.
 */
namespace Private {
  /**
   * An implementation of a document context.
   *
   * This class is typically instantiated by the document manger.
   */
  export
  class Context<T extends DocumentRegistry.IModel> implements DocumentRegistry.IContext<T> {
    /**
     * Construct a new document context.
     */
    constructor(options: Context.IOptions<T>) {
      const manager = this._manager = options.manager;
      this.factory = options.factory;
      this._opener = options.opener || Private.noOp;
      this._path = options.path;
      this._contentsModel = options.contentsModel;
      const model = this.model = options.model;

      let ext = PathExt.extname(this.path);

      // Update the kernel preference.
      let kernelPreference = options.kernelPreference;
      let name = (
        model.defaultKernelName || kernelPreference.name
      );
      let language = (
        model.defaultKernelLanguage || kernelPreference.language
      );
      kernelPreference = {
        ...kernelPreference,
        name,
        language
      };
      const localPath = manager.contents.localPath(this.path);
      this.session = new ClientSession({
        manager: manager.sessions,
        path: this.path,
        type: ext === '.ipynb' ? 'notebook' : 'file',
        name: PathExt.basename(localPath),
        kernelPreference
      });
      this.session.propertyChanged.connect(this._onSessionChanged, this);
      manager.contents.fileChanged.connect(this._onFileChanged, this);

      this.urlResolver = new RenderMimeRegistry.UrlResolver({
        session: this.session,
        contents: manager.contents
      });
    }

    /**
     * A signal emitted when the path changes.
     */
    get pathChanged(): ISignal<this, string> {
      return this._pathChanged;
    }

    /**
     * A signal emitted when the model is saved or reverted.
     */
    get fileChanged(): ISignal<this, Contents.IModel> {
      return this._fileChanged;
    }

    /**
     * A signal emitted when the context is disposed.
     */
    get disposed(): ISignal<this, void> {
      return this._disposed;
    }

    /**
     * Get the model associated with the document.
     */
    readonly model: T;

    /**
     * The client session object associated with the context.
     */
    readonly session: ClientSession;

    /**
     * The current path associated with the document.
     */
    get path(): string {
      return this._path;
    }

    /**
     * The current local path associated with the document.
     * If the document is in the default notebook file browser,
     * this is the same as the path.
     */
    get localPath(): string {
      return this._manager.contents.localPath(this.path);
    }

    /**
     * The current contents model associated with the document.
     */
    get contentsModel(): Contents.IModel {
      return this._contentsModel;
    }

    /**
     * The model factory associated with the document.
     */
    readonly factory: DocumentRegistry.IModelFactory<T>;

    /**
     * Test whether the context is disposed.
     */
    get isDisposed(): boolean {
      return this._isDisposed;
    }

    /**
     * Dispose of the resources held by the context.
     */
    dispose(): void {
      if (this.isDisposed) {
        return;
      }
      this._isDisposed = true;
      this.session.dispose();
      this.model.dispose();
      this._disposed.emit(void 0);
      Signal.clearData(this);
    }

    /**
     * The url resolver for the context.
     */
    readonly urlResolver: IRenderMime.IResolver;

    /**
     * Save the document contents to disk.
     */
    save(): Promise<void> {
      const model = this.model;
      return Promise.resolve(undefined).then(() => {
        if (!model.modelDB.isCollaborative) {
          return this._maybeSave();
        }
        return this._save();
      }).then(value => {
        if (this.isDisposed) {
          return;
        }
        model.dirty = false;
        this._updateContentsModel(value);
      }).catch(err => {
        this._handleError(err, 'File Save Error');
      });
    }

    /**
     * Save the document to a different path chosen by the user.
     */
    saveAs(): Promise<void> {
      return Private.getSavePath(this.path).then(newPath => {
        if (this.isDisposed || !newPath) {
          return;
        }
        if (newPath === this.path) {
          return this.save();
        }
        // Make sure the path does not exist.
        return this._manager.contents.get(newPath).then(() => {
          return this._maybeOverWrite(newPath);
        }).catch(err => {
          if (!err.response || err.response.status !== 404) {
            throw err;
          }
          return this._finishSaveAs(newPath);
        });
      });
    }

    /**
     * Revert the document contents to disk contents.
     */
    revert(): Promise<void> {
      let contents = this._manager.contents;
      let factory = this.factory;
      let path = this.path;
      let model = this.model;
      return Private.loadModel(contents, factory, model, path).then(contents => {
        if (this.isDisposed) {
          return;
        }
        this._updateContentsModel(contents);
      }).catch(err => {
        this._handleError(err, 'File Load Error');
      });
    }

    /**
     * Create a checkpoint for the file.
     */
    createCheckpoint(): Promise<Contents.ICheckpointModel> {
      let contents = this._manager.contents;
      return contents.createCheckpoint(this.path);
    }

    /**
     * Delete a checkpoint for the file.
     */
    deleteCheckpoint(checkpointId: string): Promise<void> {
      let contents = this._manager.contents;
      return contents.deleteCheckpoint(this.path, checkpointId);
    }

    /**
     * Restore the file to a known checkpoint state.
     */
    restoreCheckpoint(checkpointId?: string): Promise<void> {
      let contents = this._manager.contents;
      let path = this.path;
      return Promise.resolve(undefined).then(() => {
        if (checkpointId) {
          return contents.restoreCheckpoint(path, checkpointId);
        }
        return this.listCheckpoints().then(checkpoints => {
          if (this.isDisposed || !checkpoints.length) {
            return;
          }
          checkpointId = checkpoints[checkpoints.length - 1].id;
          return contents.restoreCheckpoint(path, checkpointId);
        });
      });
    }

    /**
     * List available checkpoints for a file.
     */
    listCheckpoints(): Promise<Contents.ICheckpointModel[]> {
      let contents = this._manager.contents;
      return contents.listCheckpoints(this.path);
    }

    /**
     * Add a sibling widget to the document manager.
     *
     * @param widget - The widget to add to the document manager.
     *
     * @param options - The desired options for adding the sibling.
     *
     * @returns A disposable used to remove the sibling if desired.
     *
     * #### Notes
     * It is assumed that the widget has the same model and context
     * as the original widget.
     */
    addSibling(widget: Widget, options: DocumentRegistry.IOpenOptions = {}): IDisposable {
      let opener = this._opener;
      if (opener) {
        opener(widget, options);
      }
      return new DisposableDelegate(() => {
        widget.close();
      });
    }

    /**
     * Handle a change on the contents manager.
     */
    private _onFileChanged(sender: Contents.IManager, change: Contents.IChangedArgs): void {
      if (change.type !== 'rename') {
        return;
      }
      let oldPath = change.oldValue && change.oldValue.path;
      let newPath = change.newValue && change.newValue.path;
      if (newPath && oldPath === this.path) {
        this.session.setPath(newPath);
        const localPath = this._manager.contents.localPath(newPath);
        this.session.setName(PathExt.basename(localPath));
        this._path = newPath;
        this._updateContentsModel(change.newValue as Contents.IModel);
        this._hasCheckpointed = false;
        this._pathChanged.emit(this.path);
      }
    }

    /**
     * Handle a change to a session property.
     */
    private _onSessionChanged(sender: IClientSession, type: string): void {
      if (type !== 'path') {
        return;
      }
      let path = this.session.path;
      if (path !== this.path) {
        this._path = path;
        this._hasCheckpointed = false;
        this._pathChanged.emit(path);
      }
    }

    /**
     * Update our contents model, without the content.
     */
    private _updateContentsModel(model: Contents.IModel): void {
      let newModel: Contents.IModel = {
        path: model.path,
        name: model.name,
        type: model.type,
        content: undefined,
        writable: model.writable,
        created: model.created,
        last_modified: model.last_modified,
        mimetype: model.mimetype,
        format: model.format
      };
      let mod = this.contentsModel.last_modified;
      this._contentsModel = newModel;
      if (!mod || newModel.last_modified !== mod) {
        this._fileChanged.emit(newModel);
      }
    }

    /**
     * Save the model.
     */
    private _save(): Promise<Contents.IModel> {
      return this._maybeCheckpoint().then(() => Private.saveModel(
        this._manager.contents, this.factory, this.model, this.path
      ));
    }

    /**
     * Save a file, dealing with conflicts.
     */
    private _maybeSave(): Promise<Contents.IModel> {
      // Make sure the file has not changed on disk.
      let promise = this._manager.contents.get(this.path, { content: false });
      return promise.then(model => {
        if (this.isDisposed) {
          return Promise.reject('Disposed');
        }
        // We want to check last_modified (disk) > last_modified (client)
        // (our last save)
        // In some cases the filesystem reports an inconsistent time,
        // so we allow 0.5 seconds difference before complaining.
        let modified = this.contentsModel && this.contentsModel.last_modified;
        let tClient = new Date(modified);
        let tDisk = new Date(model.last_modified);
        if (modified && (tDisk.getTime() - tClient.getTime()) > 500) {  // 500 ms
          return this._timeConflict(tClient, model);
        }
        return this._save();
      }, (err) => {
        if (err.response && err.response.status === 404) {
          return this._save();
        }
        throw err;
      });
    }

    /**
     * Handle a save/load error with a dialog.
     */
    private _handleError(err: Error | ServerConnection.ResponseError, title: string): void {
      let buttons = [Dialog.okButton()];

      // Check for a more specific error message.
      if (err instanceof ServerConnection.ResponseError) {
        err.response.text().then(text => {
          let body = '';
          try {
            body = JSON.parse(text).message;
          } catch (e) {
            body = text;
          }
          body = body || err.message;
          showDialog({ title, body, buttons });
        });
      } else {
        let body = err.message;
        showDialog({ title, body, buttons });
      }
    }

    /**
     * Add a checkpoint the file is writable and we have not yet
     * created a checkpoint.
     */
    private _maybeCheckpoint(): Promise<void> {
      let writable = this.contentsModel.writable;
      if (!writable || this._hasCheckpointed) {
        return Promise.resolve(void 0);
      }
      return this.listCheckpoints().then(checkpoints => {
        writable = this.contentsModel.writable;
        if (!this.isDisposed && !checkpoints.length && writable) {
          return this.createCheckpoint().then(() => {
            this._hasCheckpointed = true;
          });
        }
      }).catch(err => {
        // Handle a read-only folder.
        if (!err.response || err.response.status !== 403) {
          throw err;
        }
      });
    }

    /**
     * Handle a time conflict.
     */
    private _timeConflict(tClient: Date, model: Contents.IModel): Promise<Contents.IModel> {
      let tDisk = new Date(model.last_modified);
      console.warn(`Last saving peformed ${tClient} ` +
                   `while the current file seems to have been saved ` +
                   `${tDisk}`);
      let body = `The file has changed on disk since the last time it ` +
                 `ws opened or saved. ` +
                 `Do you want to overwrite the file on disk with the version ` +
                 ` open here, or load the version on disk (revert)?`;
      let revertBtn = Dialog.okButton({ label: 'REVERT' });
      let overwriteBtn = Dialog.warnButton({ label: 'OVERWRITE' });
      return showDialog({
        title: 'File Changed', body,
        buttons: [Dialog.cancelButton(), revertBtn, overwriteBtn]
      }).then(result => {
        if (this.isDisposed) {
          return Promise.reject('Disposed');
        }
        if (result.button.label === 'OVERWRITE') {
          return this._save();
        }
        if (result.button.label === 'REVERT') {
          return this.revert().then(() => { return model; });
        }
      });
    }

    /**
     * Handle a time conflict.
     */
    private _maybeOverWrite(path: string): Promise<void> {
      let body = `"${path}" already exists. Do you want to replace it?`;
      let overwriteBtn = Dialog.warnButton({ label: 'OVERWRITE' });
      return showDialog({
        title: 'File Overwrite?', body,
        buttons: [Dialog.cancelButton(), overwriteBtn]
      }).then(result => {
        if (this.isDisposed) {
          return Promise.reject('Disposed');
        }
        if (result.button.label === 'OVERWRITE') {
          return this._manager.contents.delete(path).then(() => {
            this._finishSaveAs(path);
          });
        }
      });
    }

    /**
     * Finish a saveAs operation given a new path.
     */
    private _finishSaveAs(newPath: string): Promise<void> {
      this._path = newPath;
      return this.session.setPath(newPath).then(() => {
        return this.session.setName(newPath.split('/').pop()!);
      }).then(() => {
        return this.save();
      });
    }

    private _manager: ServiceManager.IManager;
    private _opener: (widget: Widget, options?: DocumentRegistry.IOpenOptions) => void;
    private _path = '';
    private _contentsModel: Contents.IModel;
    private _isDisposed = false;
    private _pathChanged = new Signal<this, string>(this);
    private _fileChanged = new Signal<this, Contents.IModel>(this);
    private _disposed = new Signal<this, void>(this);
    private _hasCheckpointed = false;
  }


  /**
   * A namespace for `Context` statics.
   */
  export namespace Context {
    /**
     * The options used to initialize a context.
     */
    export
    interface IOptions<T extends DocumentRegistry.IModel> extends createContext.IOptions<T> {
      /**
       * The initial contents model
       */
      contentsModel: Contents.IModel;
    }
  }

  /**
   * Get a new file path from the user.
   */
  export
  function getSavePath(path: string): Promise<string | undefined> {
    let saveBtn = Dialog.okButton({ label: 'SAVE' });
    return showDialog({
      title: 'Save File As..',
      body: new SaveWidget(path),
      buttons: [Dialog.cancelButton(), saveBtn]
    }).then(result => {
      if (result.button.label === 'SAVE') {
        return result.value;
      }
      return;
    });
  }

  /**
   * Save a model.
   */
  export
  function saveModel(manager: Contents.IManager, factory: DocumentRegistry.IModelFactory, model: DocumentRegistry.IModel, path: string): Promise<Contents.IModel> {
    let content: JSONValue;
    if (factory.fileFormat === 'json') {
      content = model.toJSON();
    } else {
      content = model.toString();
    }

    let options = {
      type: factory.contentType,
      format: factory.fileFormat,
      content
    };
    return manager.save(path, options);
  }

  /**
   * Load a model.
   */
  export
  function loadModel(manager: Contents.IManager, factory: DocumentRegistry.IModelFactory, model: DocumentRegistry.IModel, path: string): Promise<Contents.IModel> {
    let opts: Contents.IFetchOptions = {
      format: factory.fileFormat,
      type: factory.contentType,
      content: true
    };
    return manager.get(path, opts).then(contents => {
      updateModel(model, contents);
      return contents;
    });
  }

  /**
   * Update a model from disk contents.
   */
  function updateModel(model: DocumentRegistry.IModel, contents: Contents.IModel): void {
    let dirty = false;
    if (contents.format === 'json') {
      model.fromJSON(contents.content);
    } else {
      let content = contents.content;
      // Convert line endings if necessary, marking the file
      // as dirty.
      if (content.indexOf('\r') !== -1) {
        dirty = true;
        content = content.replace(/\r\n|\r/g, '\n');
      }
      model.fromString(content);
    }
    model.dirty = dirty;
  }

  /**
   * A no-op function.
   */
  export
  function noOp() { /* no-op */ }

  /*
   * A widget that gets a file path from a user.
   */
  class SaveWidget extends Widget {
    /**
     * Construct a new save widget.
     */
    constructor(path: string) {
      super({ node: createSaveNode(path) });
    }

    /**
     * Get the value for the widget.
     */
    getValue(): string {
      return (this.node as HTMLInputElement).value;
    }
  }

  /**
   * Create the node for a save widget.
   */
  function createSaveNode(path: string): HTMLElement {
    let input = document.createElement('input');
    input.value = path;
    return input;
  }
}
