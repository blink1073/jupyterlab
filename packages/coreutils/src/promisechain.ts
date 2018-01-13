// Copyright (c) Jupyter Development Team.
// Distributed under the terms of the Modified BSD License.

import {
  PromiseDelegate
} from '@phosphor/coreutils';


/**
 * An object that manages a promise chain.
 */
export
class PromiseChain<T> {
  /**
   * Execute a callback on the chain
   */
  execute(callback: () => Promise<T>): Promise<T> {
    const delegate = new PromiseDelegate<T>();

    if (this._outstanding) {
      this._outstanding.resolve(delegate.promise);
    }
    this._outstanding = delegate;

    callback().then(result => {
      this._outstanding.resolve(result);
      this._outstanding = null;
    }).catch(reason => {
      this._outstanding.reject(reason);
      this._outstanding = null;
    });

    return delegate.promise;
  }

  private _outstanding: PromiseDelegate<T> | null = null;
}
