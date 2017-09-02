// Copyright (c) Jupyter Development Team.
// Distributed under the terms of the Modified BSD License.

import {
  ServiceManager
} from '@jupyterlab/services';

import {
  IDisposable
} from '@phosphor/disposable';

import {
  Signal
} from '@phosphor/signaling';

import {
  DocumentRegistry
} from '@jupyterlab/docregistry';


/**
 * A class that manages the auto saving of a document.
 *
 * #### Notes
 * Implements https://github.com/ipython/ipython/wiki/IPEP-15:-Autosaving-the-IPython-Notebook.
 */
export
class SaveHandler implements IDisposable {
  /**
   * Construct a new save handler.
   */
  constructor(options: SaveHandler.IOptions) {
    this._manager = options.manager;
    this._context = options.context;
    let interval = options.saveInterval || 120;
    this._minInterval = interval * 1000;
    this._interval = this._minInterval;
    // Restart the timer when the contents model is updated.
    this._context.fileChanged.connect(this._setTimer, this);
    this._context.disposed.connect(this.dispose, this);
  }

  /**
   * The save interval used by the timer (in seconds).
   */
  get saveInterval(): number {
    return this._interval / 1000;
  }
  set saveInterval(value: number) {
    this._minInterval = this._interval = value * 1000;
    if (this._isActive) {
      this._setTimer();
    }
  }

  /**
   * Get whether the handler is active.
   */
  get isActive(): boolean {
    return this._isActive;
  }

  /**
   * Get whether the save handler is disposed.
   */
  get isDisposed(): boolean {
    return this._isDisposed;
  }

  /**
   * Dispose of the resources used by the save handler.
   */
  dispose(): void {
    if (this.isDisposed) {
      return;
    }
    this._isDisposed = true;
    clearTimeout(this._autosaveTimer);
    Signal.clearData(this);
  }

  /**
   * Start the autosaver.
   */
  start(): void {
    this._isActive = true;
    this._setTimer();
  }

  /**
   * Stop the autosaver.
   */
  stop(): void {
    this._isActive = false;
    clearTimeout(this._autosaveTimer);
  }

  /**
   * Set the timer.
   */
  private _setTimer(): void {
    clearTimeout(this._autosaveTimer);
    if (!this._isActive) {
      return;
    }
    this._autosaveTimer = window.setTimeout(() => {
      this._save();
    }, this._interval);
  }

  /**
   * Handle an autosave timeout.
   */
  private _save(): void {
    let context = this._context;

    // Trigger the next update.
    this._setTimer();

    if (!context) {
      return;
    }

    // Bail if the model is not dirty or it is read only, or the dialog
    // is already showing.
    if (!context.model.dirty || context.model.readOnly || this._inDialog) {
      return;
    }

    let start = new Date().getTime();
    context.save().then(() => {
      if (this.isDisposed) {
        return;
      }
      let duration = new Date().getTime() - start;
      // New save interval: higher of 10x save duration or min interval.
      this._interval = Math.max(this._multiplier * duration, this._minInterval);
      // Restart the update to pick up the new interval.
      this._setTimer();
    }).catch(err => {
      console.error('Error in Auto-Save', err.message);
    });
  }

  private _autosaveTimer = -1;
  private _minInterval = -1;
  private _interval = -1;
  private _context: DocumentRegistry.Context;
  private _manager: ServiceManager.IManager;
  private _isActive = false;
  private _inDialog = false;
  private _isDisposed = false;
  private _multiplier = 10;
}


/**
 * A namespace for `SaveHandler` statics.
 */
export
namespace SaveHandler {
  /**
   * The options used to create a save handler.
   */
  export
  interface IOptions {
    /**
     * The context asssociated with the file.
     */
    context: DocumentRegistry.Context;

    /**
     * The service manager to use for checking last saved.
     */
    manager: ServiceManager.IManager;

    /**
     * The minimum save interval in seconds (default is two minutes).
     */
    saveInterval?: number;
  }
}
