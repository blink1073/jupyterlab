// Copyright (c) Jupyter Development Team.
// Distributed under the terms of the Modified BSD License.


import {
  IClientSession
} from '@jupyterlab/apputils';

import {
  uuid
} from '@jupyterlab/coreutils';

import {
  DocumentRegistry, Context
} from '@jupyterlab/docregistry';

import {
  Contents, Kernel, ServiceManager
} from '@jupyterlab/services';

import {
  ArrayExt, each, find, map, toArray
} from '@phosphor/algorithm';

import {
  Token
} from '@phosphor/coreutils';

import {
  IDisposable
} from '@phosphor/disposable';

import {
  AttachedProperty
} from '@phosphor/properties';

import {
  ISignal, Signal
} from '@phosphor/signaling';

import {
  Widget
} from '@phosphor/widgets';

import {
  SaveHandler
} from './savehandler';

import {
  DocumentWidgetManager
} from './widgetmanager';


/* tslint:disable */
/**
 * The document registry token.
 */
export
const IDocumentManager = new Token<IDocumentManager>('@jupyterlab/docmanager:IDocumentManager');
/* tslint:enable */


/**
 * The interface for a document manager.
 */
export
interface IDocumentManager extends DocumentManager {}


/**
 * A manager handling the lifecycle of document widgets.
 */
export
class DocumentManager implements IDisposable {
  /**
   * Construct a new document manager.
   */
  constructor(options: DocumentManager.IOptions) {
    this.registry = options.registry;
    this._services = options.services;
    this._opener = options.opener;

    let widgetManager = new DocumentWidgetManager({ registry: this.registry });
    widgetManager.activateRequested.connect(this._onActivateRequested, this);
    this._widgetManager = widgetManager;
  }

  /**
   * The registry used by the manager.
   */
  readonly registry: DocumentRegistry;

  /**
   * A signal emitted when one of the documents is activated.
   */
  get activateRequested(): ISignal<this, string> {
    return this._activateRequested;
  }

  /**
   * Get whether the document manager has been disposed.
   */
  get isDisposed(): boolean {
    return this._isDisposed;
  }

  /**
   * Dispose of the resources held by the document manager.
   */
  dispose(): void {
    if (this.isDisposed) {
      return;
    }
    this._isDisposed = true;
    Signal.clearData(this);
    each(toArray(this._contexts), context => {
      this._widgetManager.closeWidgets(context);
    });
    this._widgetManager.dispose();
    this._contexts.length = 0;
  }

  /**
   * Clone a widget.
   *
   * @param widget - The source widget.
   *
   * @returns A new widget or `undefined`.
   *
   * #### Notes
   *  Uses the same widget factory and context as the source, or returns
   *  `undefined` if the source widget is not managed by this manager.
   */
  cloneWidget(widget: Widget): DocumentRegistry.IPlaceHolder | undefined {
    return this._widgetManager.cloneWidget(widget);
  }

  /**
   * Close all of the open documents.
   */
  closeAll(): Promise<void> {
    return Promise.all(
      toArray(map(this._contexts, context => {
        return this._widgetManager.closeWidgets(context);
      }))
    ).then(() => undefined);
  }

  /**
   * Close the widgets associated with a given path.
   *
   * @param path - The target path.
   */
  closeFile(path: string): Promise<void> {
    let context = this._contextForPath(path);
    if (context) {
      return this._widgetManager.closeWidgets(context);
    }
    return Promise.resolve(void 0);
  }

  /**
   * Create a new file and return the widget used to view it.
   *
   * @param path - The file path to create.
   *
   * @param widgetName - The name of the widget factory to use. 'default' will use the default widget.
   *
   * @param kernel - An optional kernel name/id to override the default.
   *
   * @returns A promise that resolves with a document widget.
   *
   * #### Notes
   * This function will resolve with `undefined` if a valid widget factory
   * cannot be found.
   */
  createNew(path: string, widgetName='default', kernel?: Partial<Kernel.IModel>): Promise<DocumentRegistry.IDocumentWidget> {
    return this._createOrOpenDocument('create', path, widgetName, kernel);
  }

  /**
   * See if a widget already exists for the given path and widget name.
   *
   * @param path - The file path to use.
   *
   * @param widgetName - The name of the widget factory to use. 'default' will use the default widget.
   *
   * @returns The found widget, or `undefined`.
   *
   * #### Notes
   * This can be used to use an existing widget instead of opening
   * a new widget.
   */
  findWidget(path: string, widgetName='default'): DocumentManager.IPlaceHolder | undefined {
    if (widgetName === 'default') {
      let factory = this.registry.defaultWidgetFactory(path);
      if (!factory) {
        return undefined;
      }
      widgetName = factory.name;
    }
    let context = this._contextForPath(path);
    if (context) {
      return this._widgetManager.findWidget(context, widgetName);
    }
    return undefined;
  }

  /**
   * Open a file and return the widget used to view it.
   *
   * @param path - The file path to open.
   *
   * @param widgetName - The name of the widget factory to use. 'default' will use the default widget.
   *
   * @param kernel - An optional kernel name/id to override the default.
   *
   * @returns The created widget, or `undefined`.
   *
   * #### Notes
   * This function will return `undefined` if a valid widget factory
   * cannot be found.
   */
  open(path: string, widgetName='default', kernel?: Partial<Kernel.IModel>, options?: DocumentRegistry.IOpenOptions ): DocumentManager.IPlaceHolder | undefined {
    return this._createOrOpenDocument('open', path, widgetName, kernel, options);
  }

  /**
   * Open a file and return the widget used to view it.
   * Reveals an already existing editor.
   *
   * @param path - The file path to open.
   *
   * @param widgetName - The name of the widget factory to use. 'default' will use the default widget.
   *
   * @param kernel - An optional kernel name/id to override the default.
   *
   * @returns The created widget, or `undefined`.
   *
   * #### Notes
   * This function will return `undefined` if a valid widget factory
   * cannot be found.
   */
  openOrReveal(path: string, widgetName='default', kernel?: Partial<Kernel.IModel>, options?: DocumentRegistry.IOpenOptions ): DocumentManager.IPlaceHolder | undefined {
    let widget = this.findWidget(path, widgetName);
    if (widget) {
      this._opener.open(widget, options || {});
      return widget;
    }
    return this.open(path, widgetName, kernel, options || {});
  }

  /**
   * Find a context for a given path and factory name.
   */
  private _findContext(path: string, factoryName: string): Private.IContext | undefined {
    return find(this._contexts, context => {
      return context.factoryName === factoryName && context.path === path;
    });
  }

  /**
   * Get a context for a given path.
   */
  private _contextForPath(path: string): Private.IContext | undefined {
    return find(this._contexts, context => context.path === path);
  }

  /**
   * Create a context from a path and a model factory.
   */
  private _createContext(path: string, factory: DocumentRegistry.ModelFactory, kernelPreference: IClientSession.IKernelPreference): Private.IContext {
    // Allow options to be passed when adding a sibling.
    let adopter = (widget: Widget, options?: DocumentRegistry.IOpenOptions) => {
      this._widgetManager.adoptWidget(context, widget);
      this._opener.open(widget, options);
    };
    let modelDBFactory = this._services.contents.getModelDBFactory(path) || undefined;
    let context = new Context({
      opener: adopter,
      manager: this.services,
      factory,
      path,
      kernelPreference,
      modelDBFactory
    });
    let handler = new SaveHandler({ context });
    Private.saveHandlerProperty.set(context, handler);
    context.ready.then(() => {
      handler.start();
    });
    context.disposed.connect(this._onContextDisposed, this);
    this._contexts.push(context);
    return context;
  }

  /**
   * Handle a context disposal.
   */
  private _onContextDisposed(context: Private.IContext): void {
    ArrayExt.removeFirstOf(this._contexts, context);
  }

  /**
   * Get the widget factory for a given widget name.
   */
  private _widgetFactoryFor(path: string, widgetName: string): DocumentRegistry.WidgetFactory | undefined {
    let { registry } = this;
    if (widgetName === 'default') {
      let factory = registry.defaultWidgetFactory(path);
      if (!factory) {
        return undefined;
      }
      widgetName = factory.name;
    }
    return registry.getWidgetFactory(widgetName);
  }

  /**
   * Creates a new document, or loads one from disk, depending on the `which` argument.
   * If `which==='create'`, then it creates a new document. If `which==='open'`,
   * then it loads the document from disk.
   *
   * The two cases differ in how the document context is handled, but the creation
   * of the widget and launching of the kernel are identical.
   */
  private _createOrOpenDocument(which: 'open'|'create', path: string, widgetName='default', kernel?: Partial<Kernel.IModel>, options?: DocumentRegistry.IOpenOptions): DocumentRegistry.IReadyWidget | undefined {
    let widgetFactory = this._widgetFactoryFor(path, widgetName);
    if (!widgetFactory) {
      return undefined;
    }
    let modelName = widgetFactory.modelName || 'text';
    let factory = this.registry.getModelFactory(modelName);
    if (!factory) {
      return undefined;
    }

    // Handle the kernel pereference.
    let preference = this.registry.getKernelPreference(
      path, widgetFactory.name, kernel
    );

    let context: Private.IContext | null = null;

    // Handle the load-from-disk case
    if (which === 'open') {
      // Use an existing context if available.
      context = this._findContext(path, factory.name) || null;
      if (!context) {
        context = this._createContext(path, factory, preference);
        // Populate the model, either from disk or a
        // model backend.
        context.fromStore();
      }
    } else if (which === 'create') {
      context = this._createContext(path, factory, preference);
      // Immediately save the contents to disk.
      context.save();
    }

    let widget = this._widgetManager.createWidget(widgetFactory, context!);
    this._opener.open(widget, options || {});
    return widget;
  }

  /**
   * Handle an activateRequested signal from the widget manager.
   */
  private _onActivateRequested(sender: DocumentWidgetManager, args: string): void {
    this._activateRequested.emit(args);
  }

  private _activateRequested = new Signal<this, string>(this);
  private _contexts: Private.IContext[] = [];
  private _opener: DocumentManager.IWidgetOpener;
  private _widgetManager: DocumentWidgetManager;
  private _services: ServiceManager.IManager;
  private _isDisposed = false;
}


/**
 * A namespace for document manager statics.
 */
export
namespace DocumentManager {
  /**
   * The options used to initialize a document manager.
   */
  export
  interface IOptions {
    /**
     * A document registry instance.
     */
    registry: DocumentRegistry;

    /**
     * A service manager instance.
     */
    services: ServiceManager.IManager;

    /**
     * A widget opener for sibling widgets.
     */
    opener: IWidgetOpener;
  }

  /**
   * The interface for a placeholder widget.
   */
  export
  interface IPlaceHolder extends Widget {
    /**
     * A promise that resolves with the document widget.
     */
    widgetPromise: Promise<DocumentRegistry.IDocumentWidget>;
  }

  /**
   * An interface for a widget opener.
   */
  export
  interface IWidgetOpener {
    /**
     * Open the given widget.
     */
    open(widget: Widget, options?: DocumentRegistry.IOpenOptions): void;
  }
}


/**
 * A namespace for private data.
 */
namespace Private {
  /**
   * An attached property for a context save handler.
   */
  export
  const saveHandlerProperty = new AttachedProperty<DocumentRegistry.Context, SaveHandler | undefined>({
    name: 'saveHandler',
    create: () => undefined
  });

  /**
   * A type alias for a standard context.
   */
  export
  interface IContext extends Context<DocumentRegistry.IModel> { /* no op */ }
}
