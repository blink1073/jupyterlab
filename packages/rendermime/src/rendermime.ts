// Copyright (c) Jupyter Development Team.
// Distributed under the terms of the Modified BSD License.

import {
  Contents, Session
} from '@jupyterlab/services';

import {
  ArrayExt, ArrayIterator, IIterable, find, iter, map, toArray
} from '@phosphor/algorithm';

import {
  DataStore
} from '@phosphor/datastore';

import {
  IRenderMime
} from '@jupyterlab/rendermime-interfaces';

import {
  PathExt, URLExt
} from '@jupyterlab/coreutils';

import {
  IClientSession, ISanitizer, defaultSanitizer
} from '@jupyterlab/apputils';

import {
  HTMLRenderer, LatexRenderer, ImageRenderer, TextRenderer,
  JavaScriptRenderer, SVGRenderer, MarkdownRenderer, PDFRenderer
} from './renderers';

import {
  mimeReducer
} from './reducers';

import {
  RenderedText
} from './widgets';


/**
 * A composite renderer.
 *
 * The renderer is used to render mime models using registered
 * mime renderers, selecting the preferred mime renderer to
 * render the model into a widget.
 */
export
class RenderMime implements IRenderMime {
  /**
   * Construct a renderer.
   */
  constructor(options: RenderMime.IOptions = {}) {
    if (options.items) {
      for (let item of options.items) {
        this._order.push(item.mimeType);
        this._renderers[item.mimeType] = item.renderer;
      }
    }
    this.sanitizer = options.sanitizer || defaultSanitizer;
    this._resolver = options.resolver || null;
    this._handler = options.linkHandler || null;
    this._store = options.dataStore || RenderMime.defaultDataStore;
  }

  /**
   * The object used to resolve relative urls for the rendermime instance.
   */
  get resolver(): IRenderMime.IResolver {
    return this._resolver;
  }
  set resolver(value: IRenderMime.IResolver) {
    this._resolver = value;
  }

  /**
   * The object used to handle path opening links.
   */
  get linkHandler(): IRenderMime.ILinkHandler {
    return this._handler;
  }
  set linkHandler(value: IRenderMime.ILinkHandler) {
    this._handler = value;
  }

  /**
   * Get an iterator over the ordered list of mimeTypes.
   *
   * #### Notes
   * These mimeTypes are searched from beginning to end, and the first matching
   * mimeType is used.
   */
  mimeTypes(): IIterable<string> {
    return new ArrayIterator(this._order);
  }

  /**
   * Render a mime model.
   *
   * @param model - the mime model to render.
   *
   * #### Notes
   * Renders the model using the preferred mime type.  See
   * [[preferredMimeType]].
   */
  render(id: number, store: IRenderMime.RenderMimeStore): IRenderMime.IReadyWidget {
    let mimeType = this.preferredMimeType(id, store);
    if (!mimeType) {
      return this._handleError(id, store);
    }
    let rendererOptions = {
      mimeType,
      modelId: id,
      dataStore: store,
      resolver: this._resolver,
      sanitizer: this.sanitizer,
      linkHandler: this._handler
    };
    return this._renderers[mimeType].render(rendererOptions);
  }

  /**
   * Find the preferred mimeType for a model.
   *
   * @param model - the mime model of interest.
   *
   * #### Notes
   * The mimeTypes in the model are checked in preference order
   * until a renderer returns `true` for `.canRender`.
   */
  preferredMimeType(id: number, store: IRenderMime.RenderMimeStore): string {
    let sanitizer = this.sanitizer;
    let model = store.state.mimeModels.byId[id];
    let data = store.state.mimeBundles.byId[model.dataId];
    return find(this._order, mimeType => {
      if (data[mimeType]) {
        let options = { mimeType, modelId: id, dataStore: store, sanitizer };
        let renderer = this._renderers[mimeType];
        let canRender = false;
        try {
          canRender = renderer.canRender(options);
        } catch (err) {
          console.error(
            `Got an error when checking the renderer for the mimeType '${mimeType}'\n`, err);
        }
        if (canRender) {
          return true;
        }
      }
    });
  }

  /**
   * Create a mime model given mime model options.
   *
   * @param options - the options used to create the mime model.
   *
   * @returns The id of the created mime model.
   */
  createMimeModel(options: IRenderMime.IMimeModelOptions): number {
    // TODO.
  }

  /**
   * Clone the rendermime instance with shallow copies of data.
   *
   * #### Notes
   * The resolver is explicitly not cloned in this operation.
   */
  clone(): RenderMime {
    let items = toArray(map(this._order, mimeType => {
      return { mimeType, renderer: this._renderers[mimeType] };
    }));
    return new RenderMime({
      items,
      sanitizer: this.sanitizer,
      linkHandler: this._handler,
      dataStore: this._store
    });
  }

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
  addRenderer(item: IRenderMime.IRendererItem, index = 0): void {
    let { mimeType, renderer } = item;
    let orig = ArrayExt.removeFirstOf(this._order, mimeType);
    if (orig !== -1 && orig < index) {
      index -= 1;
    }
    this._renderers[mimeType] = renderer;
    ArrayExt.insert(this._order, index, mimeType);
  }

  /**
   * Remove a renderer by mimeType.
   *
   * @param mimeType - The mimeType of the renderer.
   */
  removeRenderer(mimeType: string): void {
    delete this._renderers[mimeType];
    ArrayExt.removeFirstOf(this._order, mimeType);
  }

  /**
   * Get a renderer by mimeType.
   *
   * @param mimeType - The mimeType of the renderer.
   *
   * @returns The renderer for the given mimeType, or undefined if the mimeType is unknown.
   */
  getRenderer(mimeType: string): IRenderMime.IRenderer {
    return this._renderers[mimeType];
  }

  /**
   * Return a widget for an error.
   */
  private _handleError(id: number, store: IRenderMime.RenderMimeStore): IRenderMime.IReadyWidget {
   let errModel = this.createMimeModel({
      data: {
        'application/vnd.jupyter.stderr': 'Unable to render data'
      }
   });
   let options = {
      mimeType: 'application/vnd.jupyter.stderr',
      modelId: errModel,
      dataStore: this._store,
      sanitizer: this.sanitizer,
    };
   return new RenderedText(options);
  }

  readonly sanitizer: ISanitizer;

  private _renderers: { [key: string]: IRenderMime.IRenderer } = Object.create(null);
  private _order: string[] = [];
  private _resolver: IRenderMime.IResolver | null;
  private _handler: IRenderMime.ILinkHandler | null;
  private _store: IRenderMime.RenderMimeStore;
}


/**
 * The namespace for RenderMime statics.
 */
export
namespace RenderMime {
  /**
   * The options used to initialize a rendermime instance.
   */
  export
  interface IOptions {
    /**
     * The intial renderer items.
     */
    items?: IRenderMime.IRendererItem[];

    /**
     * The sanitizer used to sanitize untrusted html inputs.
     *
     * If not given, a default sanitizer will be used.
     */
    sanitizer?: IRenderMime.ISanitizer;

    /**
     * The initial resolver object.
     *
     * The default is `null`.
     */
    resolver?: IRenderMime.IResolver;

    /**
     * An optional path handler.
     */
    linkHandler?: IRenderMime.ILinkHandler;

    /**
     * The internal data store used by the rendermime instance.
     */
    dataStore?: IRenderMime.RenderMimeStore;
  }

  /**
   * Get an array of the default renderer items.
   */
  export
  function getDefaultItems(): IRenderMime.IRendererItem[] {
    let renderers = Private.defaultRenderers;
    let items: IRenderMime.IRendererItem[] = [];
    let mimes: { [key: string]: boolean } = {};
    for (let renderer of renderers) {
      for (let mime of renderer.mimeTypes) {
        if (mime in mimes) {
          continue;
        }
        mimes[mime] = true;
        items.push({ mimeType: mime, renderer });
      }
    }
    return items;
  }

  /**
   * Register a rendermime extension module.
   */
  export
  function registerExtensionModule(mod: IRenderMime.IExtensionModule): void {
    let data = mod.default;
    // Handle commonjs exports.
    if (!mod.hasOwnProperty('__esModule')) {
      data = mod as any;
    }
    if (!Array.isArray(data)) {
      data = [data];
    }
    data.forEach(item => { Private.registeredExtensions.push(item); });
  }

  /**
   * Get the registered extensions.
   */
  export
  function getExtensions(): IIterable<IRenderMime.IExtension> {
    return iter(Private.registeredExtensions);
  }

  /**
   * A default resolver that uses a session and a contents manager.
   */
  export
  class UrlResolver implements IRenderMime.IResolver {
    /**
     * Create a new url resolver for a console.
     */
    constructor(options: IUrlResolverOptions) {
      this._session = options.session;
      this._contents = options.contents;
    }

    /**
     * Resolve a relative url to a correct server path.
     */
    resolveUrl(url: string): Promise<string> {
      if (URLExt.isLocal(url)) {
        let cwd = PathExt.dirname(this._session.path);
        url = PathExt.resolve(cwd, url);
      }
      return Promise.resolve(url);
    }

    /**
     * Get the download url of a given absolute server path.
     */
    getDownloadUrl(path: string): Promise<string> {
      if (URLExt.isLocal(path)) {
        return this._contents.getDownloadUrl(path);
      }
      return Promise.resolve(path);
    }

    private _session: Session.ISession | IClientSession;
    private _contents: Contents.IManager;
  }

  /**
   * The options used to create a UrlResolver.
   */
  export
  interface IUrlResolverOptions {
    /**
     * The session used by the resolver.
     */
    session: Session.ISession | IClientSession;

    /**
     * The contents manager used by the resolver.
     */
    contents: Contents.IManager;
  }

  /**
   * The default data store used by rendermime instances.
   */
  export
  const defaultDataStore = new DataStore<IRenderMime.IMimeStoreState>(mimeReducer, {
    mimeModels: {
      maxId: 0,
      byId: {}
    },
    mimeBundles: {
      maxId: 0,
      byId: {}
    }
  });
}


/**
 * The namespace for private module data.
 */
export
namespace Private {
  /**
   * The registered extensions.
   */
  export
  const registeredExtensions: IRenderMime.IExtension[] = [];

  /**
   * The default renderer instances.
   */
  export
  const defaultRenderers = [
    new JavaScriptRenderer(),
    new HTMLRenderer(),
    new MarkdownRenderer(),
    new LatexRenderer(),
    new SVGRenderer(),
    new ImageRenderer(),
    new PDFRenderer(),
    new TextRenderer()
  ];
}
