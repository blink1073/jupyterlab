// Copyright (c) Jupyter Development Team.
// Distributed under the terms of the Modified BSD License.

import {
  PromiseDelegate
} from '@phosphor/coreutils';


/**
 * An object that queues promises as necessary.
 */
export
class PromiseQueue<T> {
  /**
   * Execute a callback on the queue.
   */
  execute(callback: () => Promise<T>): Promise<T> {
    let delegate = new PromiseDelegate<T>();
    let promise = Promise.all(this._outstanding.slice()).then(() => {
      callback().then(result => {
        delegate.resolve(result);
        this._outstanding.shift();
      }).catch(reason => {
        delegate.reject(reason);
        this._outstanding.shift();
      });
    });
    this._outstanding.push(promise);

    return delegate.promise;
  }

  private _outstanding: Promise<void>[] = [];
}
