// Copyright (c) Jupyter Development Team.
// Distributed under the terms of the Modified BSD License.

import {
  Kernel, KernelMessage
} from '@jupyterlab/services';

import {
  IDisposable
} from 'phosphor/lib/core/disposable';

import {
  ICellEditorWidget, ITextChange, ICompletionRequest
} from '../notebook/cells/editor';

import {
  BaseCellWidget
} from '../notebook/cells/widget';

import {
  CompleterWidget
} from './widget';


/**
 * A completer handler for cell widgets.
 */
export
class CellCompleterHandler implements IDisposable {
  /**
   * Construct a new completer handler for a widget.
   */
  constructor(options: CellCompleterHandler.IOptions) {
    this._completer = options.completer;
    this._completer.selected.connect(this.onCompletionSelected, this);
    this._completer.visibilityChanged.connect(this.onVisibilityChanged, this);
    this._kernel = options.kernel || null;
  }

  /**
   * The kernel used by the completer handler.
   */
  get kernel(): Kernel.IKernel {
    return this._kernel;
  }
  set kernel(value: Kernel.IKernel) {
    this._kernel = value;
  }

  /**
   * The cell widget used by the completer handler.
   */
  get activeCell(): BaseCellWidget {
    return this._activeCell;
  }
  set activeCell(newValue: BaseCellWidget) {
    if (newValue === this._activeCell) {
      return;
    }

    if (this._activeCell && !this._activeCell.isDisposed) {
      const editor = this._activeCell.editor;
      editor.textChanged.disconnect(this.onTextChanged, this);
      editor.completionRequested.disconnect(this.onCompletionRequested, this);
    }
    this._activeCell = newValue;
    if (this._activeCell) {
      const editor = this._activeCell.editor as ICellEditorWidget;
      editor.textChanged.connect(this.onTextChanged, this);
      editor.completionRequested.connect(this.onCompletionRequested, this);
    }
  }

  /**
   * Get whether the completer handler is disposed.
   *
   * #### Notes
   * This is a read-only property.
   */
  get isDisposed(): boolean {
    return this._completer === null;
  }

  /**
   * Dispose of the resources used by the handler.
   */
  dispose(): void {
    if (this.isDisposed) {
      return;
    }
    this._completer = null;
    this._kernel = null;
    this._activeCell = null;
  }

  /**
   * Make a complete request using the kernel.
   */
  protected makeRequest(request: ICompletionRequest): Promise<void> {
    if (!this._kernel) {
      return Promise.reject(new Error('no kernel for completion request'));
    }

    let content: KernelMessage.ICompleteRequest = {
      code: request.currentValue,
      cursor_pos: request.position
    };
    let pending = ++this._pending;

    return this._kernel.requestComplete(content).then(msg => {
      this.onReply(pending, request, msg);
    });
  }

  /**
   * Receive a completion reply from the kernel.
   */
  protected onReply(pending: number, request: ICompletionRequest, msg: KernelMessage.ICompleteReplyMsg): void {
    // If we have been disposed, bail.
    if (this.isDisposed) {
      return;
    }
    // If a newer completion request has created a pending request, bail.
    if (pending !== this._pending) {
      return;
    }
    let value = msg.content;
    let model = this._completer.model;
    if (!model) {
      return;
    }
    // Completion request failures or negative results fail silently.
    if (value.status !== 'ok') {
      model.reset();
      return;
    }
    // Update the original request.
    model.original = request;
    // Update the options.
    model.setOptions(value.matches || []);
    // Update the cursor.
    model.cursor = { start: value.cursor_start, end: value.cursor_end };
  }

  /**
   * Handle a text changed signal from an editor.
   */
  protected onTextChanged(editor: ICellEditorWidget, change: ITextChange): void {
    if (!this._completer.model) {
      return;
    }
    this._completer.model.handleTextChange(change);
  }

  /**
   * Handle a completion requested signal from an editor.
   */
  protected onCompletionRequested(editor: ICellEditorWidget, request: ICompletionRequest): void {
    if (!this._kernel || !this._completer.model) {
      return;
    }
    this.makeRequest(request);
  }


  /**
   * Handle a visiblity change signal from a completer widget.
   */
  protected onVisibilityChanged(completer: CompleterWidget): void {
    if (completer.isDisposed || completer.isHidden) {
      if (this._activeCell) {
        this._activeCell.activate();
      }
    }
  }

  /**
   * Handle a completion selected signal from the completion widget.
   */
  protected onCompletionSelected(widget: CompleterWidget, value: string): void {
    if (!this._activeCell || !this._completer.model) {
      return;
    }
    let patch = this._completer.model.createPatch(value);
    if (!patch) {
      return;
    }
    let cell = this._activeCell;
    cell.model.source = patch.text;
    cell.editor.setCursorPosition(patch.position);
  }

  private _activeCell: BaseCellWidget = null;
  private _completer: CompleterWidget = null;
  private _kernel: Kernel.IKernel = null;
  private _pending = 0;
}


/**
 * A namespace for cell completer handler statics.
 */
export
namespace CellCompleterHandler {
  /**
   * The instantiation options for cell completer handlers.
   */
  export
  interface IOptions {
    /**
     * The completer widget the handler will connect to.
     */
    completer: CompleterWidget;

    /**
     * The kernel for the completer handler.
     */
    kernel?: Kernel.IKernel;
  }
}
