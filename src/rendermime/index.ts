// Copyright (c) Jupyter Development Team.
// Distributed under the terms of the Modified BSD License.

import {
  Widget
} from 'phosphor-widget';

import {
  ISanitizer, defaultSanitizer
} from '../sanitizer';


/**
 * The interface for a renderer.
 */
export
interface IRenderer {
  /**
   * The mimetypes this renderer accepts.
   *
   * #### Notes
   * This is a read-only property.
   */
  mimetypes: string[];

  /**
   * Whether the data is considered "safe" from a security standpoint.
   *
   * #### Notes
   * This is a read-only property.
   */
   safe: boolean;

  /**
   * Whether the data can be sanitized before rendering.
   *
   * #### Notes
   * This is a read-only property.
   */
  sanitizable: boolean;

  /**
   * The function that will render a mimebundle.
   *
   * @param mimetype - the mimetype for the data.
   *
   * @param data - the data to render.
   *
   * @returns a Promise that resolves with the rendered object.
   */
  render(mimetype: string, data: string): Widget | Promise<Widget>;
}


/**
 * A map of mimetypes to types.
 */
export
type MimeMap<T> = { [mimetype: string]: T };


/**
 * A composite renderer.
 *
 * #### Notes
 * When rendering a mimebundle, a mimetype is selected from the mimetypes by
 * searching through the `this.order` list. The first mimetype found in the bundle
 * determines the renderer that will be used.
 *
 * You can add a renderer by adding it to the `renderers` object and registering
 * the mimetype in the `order` array.
 */
export
class RenderMime {
  /**
   * Construct a renderer.
   */
  constructor(options: RenderMime.IOptions) {
    this._renderers = {};
    for (let i in options.renderers) {
      this._renderers[i] = options.renderers[i];
    }
    this._order = options.order.slice();
    this._sanitizer = options.santizer || defaultSanitizer;
    this._cwd = options.cwd || '';
  }

  /**
   * The current working directory of the rendermime.
   */
  get cwd() {
    return this._cwd;
  }
  set cwd(value: string) {
    this._cwd = value;
  }

  /**
   * The sanitizer used by the rendermime.
   *
   * #### Notes
   * This is a read-only property.
   */
  get sanitizer(): any {
    return this._sanitizer;
  }

  /**
   * Render a mimebundle.
   *
   * @param bundle - the mimebundle to render.
   *
   * @param trusted - whether the data is trusted.
   *
   * #### Notes
   * The [[preferredMimetype]] will for the bundle will be rendered.
   */
  render(bundle: MimeMap<string>, trusted=false): Promise<Widget> {
    let mimetype = this.preferredMimetype(bundle, trusted);
    if (mimetype) {
        return Promise.resolve(this._renderers[mimetype].render(mimetype, bundle[mimetype])).then(widget => {
          // Mangle the relative urls in the html.
          return widget;
        });
    }
  }

  /**
   * Find the preferred mimetype in a mimebundle.
   *
   * @param bundle - the mimebundle giving available mimetype content.
   *
   * @param trusted - whether the input data is trusted.
   *
   * #### Notes
   * If the bundle is not trusted, the preferred mimetype will be
   * the highest that is "safe" or "santizable".
   */
  preferredMimetype(bundle: MimeMap<string>, trusted=false): string {
    for (let m of this.order) {
      if (m in bundle) {
        return m;
      }
    }
  }

  /**
   * Clone the rendermime instance with shallow copies of data.
   */
  clone(): RenderMime {
    return new RenderMime(this._renderers, this.order);
  }

  /**
   * Get a renderer by mimetype.
   */
  getRenderer(mimetype: string) {
    return this._renderers[mimetype];
  }

  /**
   * Add a renderer by mimetype.
   *
   * @param mimetype - The mimetype of the renderer.
   * @param renderer - The renderer instance.
   * @param index - The optional order index.
   *
   * ####Notes
   * Negative indices count from the end, so -1 refers to the penultimate index.
   * Use the index of `.order.length` to add to the end of the render precedence list,
   * which would make the new renderer the last choice.
   */
  addRenderer(mimetype: string, renderer: IRenderer, index = 0): void {
    this._renderers[mimetype] = renderer;
    this._order.splice(index, 0, mimetype);
  }

  /**
   * Remove a renderer by mimetype.
   */
  removeRenderer(mimetype: string): void {
    delete this._renderers[mimetype];
    let index = this._order.indexOf(mimetype);
    if (index !== -1) {
      this._order.splice(index, 1);
    }
  }

  /**
   * Get the ordered list of mimetypes.
   *
   * #### Notes
   * These mimetypes are searched from beginning to end, and the first matching
   * mimetype is used.
   */
  get order() {
    return this._order.slice();
  }

  /**
   * Set the ordered list of mimetypes.
   */
  set order(value: string[]) {
    this._order = value.slice();
  }

  private _renderers: MimeMap<IRenderer>;
  private _order: string[];
  private _sanitizer: ISanitizer = null;
  private _cwd = '';
}


/**
 * The namespace for RenderMime statics.
 */
export
namespace RenderMime {
  /**
   * The options used to initialize a RenderMime object.
   */
  export
  interface IOptions {
    /**
     * The default map of renderers.
     */
    renderers: MimeMap<IRenderer>;

    /**
     * The preference order for the default renderers.
     */
    order: string[];

    /**
     * An optional sanitizer object.
     *
     * The default is a shared sanitizer instance.
     */
    sanitizer?: ISanitizer;

    /**
     * The initial working directory of the rendermime.
     *
     * The default is the base server path (an empty string).
     */
    cwd?: string;
  }
}
