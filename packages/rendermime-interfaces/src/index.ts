// Copyright (c) Jupyter Development Team.
// Distributed under the terms of the Modified BSD License.

import {
  IIterable
} from '@phosphor/algorithm';

import {
  JSONValue, Token
} from '@phosphor/coreutils';

import {
  Action, DataStore
} from '@phosphor/datastore';

import {
  Widget
} from '@phosphor/widgets';


/* tslint:disable */
/**
 * The rendermime token.
 */
export
const IRenderMime = new Token<IRenderMime>('jupyter.services.rendermime');
/* tslint:enable */


/**
 * The rendermime interface.
 */
export
interface IRenderMime {
  /**
   * The object used to resolve relative urls for the rendermime instance.
   */
  resolver: IRenderMime.IResolver;

  /**
   * The object used to handle path opening links.
   */
  linkHandler: IRenderMime.ILinkHandler;

  /**
   * Get an iterator over the ordered list of mimeTypes.
   *
   * #### Notes
   * These mimeTypes are searched from beginning to end, and the first matching
   * mimeType is used.
   */
  mimeTypes(): IIterable<string>;

  /**
   * Render a mime model.
   *
   * @param model - the mime model to render.
   *
   * #### Notes
   * Renders the model using the preferred mime type.  See
   * [[preferredMimeType]].
   */
  render(id: number, store: IRenderMime.RenderMimeStore): IRenderMime.IReadyWidget;

  /**
   * Find the preferred mimeType for a model.
   *
   * @param model - the mime model of interest.
   *
   * #### Notes
   * The mimeTypes in the model are checked in preference order
   * until a renderer returns `true` for `.canRender`.
   */
  preferredMimeType(id: number, store: IRenderMime.RenderMimeStore): string;

  /**
   * Clone the rendermime instance with shallow copies of data.
   *
   * #### Notes
   * The resolver is explicitly not cloned in this operation.
   */
  clone(): IRenderMime;

  /**
   * Add a renderer by mimeType.
   *
   * @param item - A renderer item.
   *
   * @param index - The optional order index.
   *
   * ####Notes
   * Negative indices count from the end, so -1 refers to the last index.
   * Use the index of `.order.length` to add to the end of the render precedence list,
   * which would make the new renderer the last choice.
   * The renderer will replace an existing renderer for the given
   * mimeType.
   */
  addRenderer(item: IRenderMime.IRendererItem, index?: number): void;

  /**
   * Remove a renderer by mimeType.
   *
   * @param mimeType - The mimeType of the renderer.
   */
  removeRenderer(mimeType: string): void;

  /**
   * Get a renderer by mimeType.
   *
   * @param mimeType - The mimeType of the renderer.
   *
   * @returns The renderer for the given mimeType, or undefined if the mimeType is unknown.
   */
  getRenderer(mimeType: string): IRenderMime.IRenderer;
}


/**
 * A namespace for IRenderMime associated interfaces.
 */
export
namespace IRenderMime {
  /**
   * A render item.
   */
  export
  interface IRendererItem {
    /**
     * The mimeType to be renderered.
     */
    mimeType: string;

    /**
     * The renderer.
     */
    renderer: IRenderer;
  }

  /**
   *
   */
  export
  interface IByIdMap<T> {
    /**
     *
     */
    readonly [id: number]: T;
  }

  /**
   *
   */
  export
  interface ITable<T> {
    /**
     *
     */
    readonly maxId: number;

    /**
     *
     */
    readonly byId: IByIdMap<T>;
  }

  /**
   * A read-only bundle of data for a mime model.
   */
  export
  interface IMimeBundle {
    readonly [key: string]: JSONValue;
  }

  /**
   * An observable model for mime data.
   */
  export
  interface IMimeModel {
    /**
     * Whether the model is trusted.
     */
    readonly trusted: boolean;

    /**
     * The data bundle id associated with the model.
     */
    readonly dataId: number;

    /**
     * The metadata bundle id associated with the model.
     */
    readonly metadataId: number;
  }

  /**
   * The store state for a mime model.
   */
  export
  interface IMimeStoreState {
    /**
     * The mime models table.
     */
    readonly mimeModels: ITable<IMimeModel>;

    /**
     * The mime models table.
     */
    readonly mimeBundles: ITable<IMimeBundle>;
  }

  /**
   * Options used to create a mime model.
   */
  export
  interface IMimeModelOptions {
    /**
     * Whether the model is trusted.
     */
    trusted?: boolean;

    /**
     * The data associated with the model.
     */
    data: IMimeBundle;

    /**
     * The metadata bundle id associated with the model.
     */
    metadata?: IMimeBundle;
  }

  /**
   * An action associated with a rendermime model store.
   */
  export
  type RenderMimeAction = (
    CreateMimeModel |
    CreateMimeBundle |
    AddToMimeBundle |
    RemoveFromMimeBundle
  );

  /**
   * A store for rendermime models.
   */
  export
  type RenderMimeStore = DataStore<IMimeStoreState>;

  /**
   * The options used to initialize a document widget factory.
   */
  export
  interface IWidgetFactoryOptions {
    /**
     * The file extensions the widget can view.
     *
     * #### Notes
     * Use "*" to denote all files. Specific file extensions must be preceded
     * with '.', like '.png', '.txt', etc.  They may themselves contain a
     * period (e.g. .table.json).
     */
    readonly fileExtensions: string[];

    /**
     * The name of the widget to display in dialogs.
     */
    readonly name: string;

    /**
     * The file extensions for which the factory should be the default.
     *
     * #### Notes
     * Use "*" to denote all files. Specific file extensions must be preceded
     * with '.', like '.png', '.txt', etc. Entries in this attribute must also
     * be included in the fileExtensions attribute.
     * The default is an empty array.
     *
     * **See also:** [[fileExtensions]].
     */
    readonly defaultFor?: string[];

    /**
     * Whether the widget factory is read only.
     */
    readonly readOnly?: boolean;

    /**
     * The registered name of the model type used to create the widgets.
     */
    readonly modelName?: string;

    /**
     * Whether the widgets prefer having a kernel started.
     */
    readonly preferKernel?: boolean;

    /**
     * Whether the widgets can start a kernel when opened.
     */
    readonly canStartKernel?: boolean;
  }

  /**
   * An interface for using a RenderMime.IRenderer for output and read-only documents.
   */
  export
  interface IExtension {
    /**
     * The MIME type for the renderer, which is the output MIME type it will handle.
     */
    mimeType: string;

    /**
     * A renderer class to be registered to render the MIME type.
     */
    renderer: IRenderer;

    /**
     * The index passed to `RenderMime.addRenderer`.
     */
    rendererIndex?: number;

    /**
     * The timeout after user activity to re-render the data.
     */
    renderTimeout?: number;

    /**
     * Preferred data type from the model.  Defaults to `string`.
     */
    dataType?: 'string' | 'json';

    /**
     * The icon class name for the widget.
     */
    iconClass?: string;

    /**
     * The icon label for the widget.
     */
    iconLabel?: string;

    /**
     * The options used for using the renderer for documents.
     */
    widgetFactoryOptions?: IWidgetFactoryOptions;
  }

  /**
   * The interface for a module that exports an extension or extensions as
   * the default value.
   */
  export
  interface IExtensionModule {
    /**
     * The default export.
     */
    default: IExtension | IExtension[];
  }

  /**
   * A widget that provides a ready promise.
   */
  export
  interface IReadyWidget extends Widget {
    /**
     * A promise that resolves when the widget is ready.
     */
    ready: Promise<void>;
  }

  /**
   * The interface for a renderer.
   */
  export
  interface IRenderer {
    /**
     * The mimeTypes this renderer accepts.
     */
    readonly mimeTypes: string[];

    /**
     * Whether the renderer can render given the render options.
     *
     * @param options - The options that would be used to render the data.
     */
    canRender(options: IRenderOptions): boolean;

    /**
     * Render the transformed mime data.
     *
     * @param options - The options used to render the data.
     */
    render(options: IRenderOptions): IReadyWidget;

    /**
     * Whether the renderer will sanitize the data given the render options.
     *
     * @param options - The options that would be used to render the data.
     */
    wouldSanitize(options: IRenderOptions): boolean;
  }

  /**
   * The options used to transform or render mime data.
   */
  export
  interface IRenderOptions {
    /**
     * The preferred mimeType to render.
     */
    mimeType: string;

    /**
     * The mime data model id.
     */
    modelId: number;

    /**
     * The mime model data store.
     */
    dataStore: RenderMimeStore;

    /**
     * The html sanitizer.
     */
    sanitizer: ISanitizer;

    /**
     * An optional url resolver.
     */
    resolver?: IResolver;

    /**
     * An optional link handler.
     */
    linkHandler?: ILinkHandler;
  }

  /**
   * An object that handles html sanitization.
   */
  export
  interface ISanitizer {
    /**
     * Sanitize an HTML string.
     */
    sanitize(dirty: string): string;
  }

  /**
   * An object that handles links on a node.
   */
  export
  interface ILinkHandler {
    /**
     * Add the link handler to the node.
     */
    handleLink(node: HTMLElement, url: string): void;
  }

  /**
   * An object that resolves relative URLs.
   */
  export
  interface IResolver {
    /**
     * Resolve a relative url to a correct server path.
     */
    resolveUrl(url: string): Promise<string>;

    /**
     * Get the download url of a given absolute server path.
     */
    getDownloadUrl(path: string): Promise<string>;
  }
}


/**
 * An action for creating a mime model.
 */
export
class CreateMimeModel extends Action<'@jupyterlab/rendermime-interfaces/CREATE_MIME_MODEL'> {
  /**
   * Construct a new CreateMimeModel object.
   */
  constructor(id: number, model: IRenderMime.IMimeModel) {
    super('@jupyterlab/rendermime-interfaces/CREATE_MIME_MODEL');
    this.id = id;
    this.model = model;
  }

  /**
   * The id of the mime model.
   */
  readonly id: number;

  /**
   * The model to add.
   */
  readonly model: IRenderMime.IMimeModel;
}


/**
 * An action for creating a mime bundle.
 */
export
class CreateMimeBundle extends Action<'@jupyterlab/rendermime-interfaces/CREATE_MIME_BUNDLE'> {
  /**
   * Construct a new CreateMimeBundle object.
   */
  constructor(id: number, bundle: IRenderMime.IMimeBundle) {
    super('@jupyterlab/rendermime-interfaces/CREATE_MIME_BUNDLE');
    this.id = id;
    this.bundle = bundle;
  }

  /**
   * The id of the mime bundle.
   */
  readonly id: number;

  /**
   * The model to add.
   */
  readonly bundle: IRenderMime.IMimeBundle;
}


/**
 * An action for adding or updating a key to a mime bundle.
 */
export
class AddToMimeBundle extends Action<'@jupyterlab/rendermime-interfaces/ADD_TO_MIME_BUNDLE'> {
  /**
   * Construct a new AddToMimeBundle object.
   */
  constructor(id: number, key: string, value: JSONValue) {
    super('@jupyterlab/rendermime-interfaces/ADD_TO_MIME_BUNDLE');
    this.id = id;
    this.key = key;
  }

  /**
   * The id of the mime bundle.
   */
  readonly id: number;

  /**
   * The key to add or update.
   */
  readonly key: string;

  /**
   * The value of the key.
   */
  readonly value: JSONValue;
}


/**
 * An action for removing a key from a mime bundle.
 */
export
class RemoveFromMimeBundle extends Action<'@jupyterlab/rendermime-interfaces/REMOVE_FROM_MIME_BUNDLE'> {
  /**
   * Construct a new RemoveFromMimeBundle object.
   */
  constructor(id: number, key: string) {
    super('@jupyterlab/rendermime-interfaces/REMOVE_FROM_MIME_BUNDLE');
    this.id = id;
    this.key = key;
  }

  /**
   * The id of the mime bundle.
   */
  readonly id: number;

  /**
   * The key to remove.
   */
  readonly key: string;
}
