// Copyright (c) Jupyter Development Team.
// Distributed under the terms of the Modified BSD License.

import {
  JSONObject
} from '@phosphor/coreutils';

import {
  Toolbar
} from '@jupyterlab/apputils';

import {
  ActivityMonitor, PromiseQueue
} from '@jupyterlab/coreutils';

import {
  IRenderMime, RenderMimeRegistry, MimeModel
} from '@jupyterlab/rendermime';

import {
  ABCWidgetFactory
} from './default';

import {
  DocumentRegistry
} from './registry';


/**
 * An implementation of a widget factory for a rendered mimetype document.
 */
export
class MimeDocumentFactory extends ABCWidgetFactory<IRenderMime.IRenderer> {
  /**
   * Construct a new markdown widget factory.
   */
  constructor(options: MimeDocumentFactory.IOptions) {
    super(Private.createRegistryOptions(options));
    this._rendermime = options.rendermime;
    this._renderTimeout = options.renderTimeout || 1000;
    this._dataType = options.dataType || 'string';
    this._mimeType = options.mimeType;
  }

  /**
   * Create a new widget given a context.
   */
  create(context: DocumentRegistry.IContext): IRenderMime.IRenderer {
    let rendermime = this._rendermime.clone({ resolver: context.urlResolver });
    return rendermime.createRenderer(this._mimeType);
  }

  /**
   * Populate a widget created by this factory and its toolbar.
   */
  populate(widget: IRenderMime.IRenderer, context: DocumentRegistry.IContext, toolbar: Toolbar): Promise<void> {
    let handler = new Private.MimeDocumentHandler({
      renderer: widget,
      context,
      mimeType: this._mimeType,
      renderTimeout: this._renderTimeout,
      dataType: this._dataType
    });
    return handler.render();
  }

  private _rendermime: RenderMimeRegistry;
  private _renderTimeout: number;
  private _dataType: 'string' | 'json';
  private _mimeType: string;
}


/**
 * The namespace for MimeDocumentFactory class statics.
 */
export
namespace MimeDocumentFactory {
  /**
   * The options used to initialize a MimeDocumentFactory.
   */
  export
  interface IOptions extends DocumentRegistry.IWidgetFactoryOptions {
    /**
     * The MIME type associated with the document.
     */
    mimeType: string;

    /**
     * The rendermime instance.
     */
    rendermime: RenderMimeRegistry;

    /**
     * The render timeout.
     */
    renderTimeout?: number;

    /**
     * Preferred data type from the model.
     */
    dataType?: 'string' | 'json';
  }
}


/**
 * The namespace for the module implementation details.
 */
namespace Private {
  /**
   * A widget for rendered mimetype document.
   */
  export
  class MimeDocumentHandler {
    /**
     * Construct a new markdown widget.
     */
    constructor(options: IHandlerOptions) {
      this._context = options.context;
      this._mimeType = options.mimeType;
      this._dataType = options.dataType || 'string';
      this._renderer = options.renderer;
      this._renderTimeout = options.renderTimeout;
    }

    /**
     * Render the mime content.
     */
    render(): Promise<void> {
      return this._queue.execute(this._render);
    }

    /**
     * Render the mime content.
     */
    private _render(): Promise<void> {
      let context = this._context;
      let model = context.model;
      let data: JSONObject = {};
      if (this._dataType === 'string') {
        data[this._mimeType] = model.toString();
      } else {
        data[this._mimeType] = model.toJSON();
      }
      let mimeModel = new MimeModel({ data, callback: this._changeCallback });

      return this._renderer.renderModel(mimeModel).then(() => {
        if (!this._hasRendered) {
          this._startMonitor();
        }
        this._hasRendered = true;
      });
    }

    /**
     * Start the activity monitor.
     */
    private _startMonitor(): void {
      // Throttle the rendering rate of the widget.
      this._monitor = new ActivityMonitor({
        signal: this._context.model.contentChanged,
        timeout: this._renderTimeout
      });
      this._renderer.disposed.connect(() => {
        this._monitor.dispose();
      }, this);
      this._monitor.activityStopped.connect(this.render, this);
    }

    /**
     * A bound change callback.
     */
    private _changeCallback = (options: IRenderMime.IMimeModel.ISetDataOptions) => {
      if (!options.data || !options.data[this._mimeType]) {
        return;
      }
      let data = options.data[this._mimeType];
      if (typeof data === 'string') {
        this._context.model.fromString(data);
      } else {
        this._context.model.fromJSON(data);
      }
    }

    private _context: DocumentRegistry.IContext;
    private _monitor: ActivityMonitor<any, any> | null;
    private _renderer: IRenderMime.IRenderer;
    private _mimeType: string;
    private _hasRendered = false;
    private _renderTimeout: number;
    private _dataType: 'string' | 'json';
    private _queue = new PromiseQueue<void>();
  }

  /**
   * The options used to initialize a MimeDocument.
   */
  export
  interface IHandlerOptions {
    /**
     * The document context.
     */
    context: DocumentRegistry.IContext;

    /**
     * The rendermime instance.
     */
    renderer: IRenderMime.IRenderer;

    /**
     * The mime type.
     */
    mimeType: string;

    /**
     * The render timeout.
     */
    renderTimeout: number;

    /**
     * Preferred data type from the model.
     */
    dataType?: 'string' | 'json';
  }

  /**
   * Create the document registry options.
   */
  export
  function createRegistryOptions(options: MimeDocumentFactory.IOptions): DocumentRegistry.IWidgetFactoryOptions {
    return { ...options, readOnly: true } as DocumentRegistry.IWidgetFactoryOptions;
  }
}
