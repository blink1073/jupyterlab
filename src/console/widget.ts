// Copyright (c) Jupyter Development Team.
// Distributed under the terms of the Modified BSD License.

import {
  ISession, KernelMessage
} from 'jupyter-js-services';

import {
  Message
} from 'phosphor-messaging';

import {
  PanelLayout
} from 'phosphor-panel';

import {
  ISignal, Signal, clearSignalData
} from 'phosphor-signaling';

import {
  Widget
} from 'phosphor-widget';

import {
  nbformat
} from '../notebook';

import {
  CodeCellWidget, CodeCellModel, RawCellModel, RawCellWidget
} from '../notebook/cells';

import {
  EdgeLocation, CellEditorWidget, ITextChange
} from '../notebook/cells/editor';

import {
  mimetypeForLanguage
} from '../notebook/common/mimetype';

import {
  CompletionWidget, CompletionModel, CellCompletionHandler
} from '../notebook/completion';

import {
  RenderMime, MimeMap
} from '../rendermime';

import {
  ConsoleHistory, IConsoleHistory
} from './history';




/**
 * The class name added to console widgets.
 */
const CONSOLE_CLASS = 'jp-Console';

/**
 * The class name added to the console banner.
 */
const BANNER_CLASS = 'jp-Console-banner';

/**
 * The class name of the active prompt
 */
const PROMPT_CLASS = 'jp-Console-prompt';


/**
 * A widget containing a Jupyter console.
 */
export
class ConsoleWidget extends Widget {
  /**
   * Construct a console widget.
   */
  constructor(options: ConsoleWidget.IOptions) {
    super();
    this.addClass(CONSOLE_CLASS);

    let layout = new PanelLayout();

    this.layout = layout;
    this._renderer = options.renderer || ConsoleWidget.defaultRenderer;
    this._rendermime = options.rendermime;
    this._session = options.session;

    this._history = new ConsoleHistory(this._session.kernel);

    // Instantiate tab completion widget.
    let completion = options.completion || new CompletionWidget({
      model: new CompletionModel()
    });
    this._completion = completion;

    // Set the completion widget's anchor node to peg its position.
    completion.anchor = this.node;

    // Because a completion widget may be passed in, check if it is attached.
    if (!completion.isAttached) {
      completion.attach(document.body);
    }

    this._completionHandler = new CellCompletionHandler(this._completion);
    this._completionHandler.kernel = this._session.kernel;

    // Create the banner.
    let banner = this._renderer.createBanner();
    banner.addClass(BANNER_CLASS);
    banner.readOnly = true;
    banner.model.source = '...';
    layout.addChild(banner);

    // Set the banner text and the mimetype.
    this.initialize();

    // Create the prompt.
    this.newPrompt();

    // Handle changes to the kernel.
    this._session.kernelChanged.connect((s, kernel) => {
      this.clear();
      this.newPrompt();
      this.initialize();
      this._history.dispose();
      this._history = new ConsoleHistory(kernel);
      this._completionHandler.kernel = kernel;
    });
  }

  /*
   * The last cell in a console is always a `CodeCellWidget` prompt.
   */
  get prompt(): CodeCellWidget {
    let layout = this.layout as PanelLayout;
    let last = layout.childCount() - 1;
    return last > 0 ? layout.childAt(last) as CodeCellWidget : null;
  }

  /**
   * Get the session used by the console.
   *
   * #### Notes
   * This is a read-only property.
   */
  get session(): ISession {
    return this._session;
  }

  /**
   * A signal emitted when an inspector value is generated.
   */
  get inspected(): ISignal<ConsoleWidget, ConsoleWidget.IInspectorUpdate> {
    return Private.inspectedSignal.bind(this);
  }

  /**
   * Dispose of the resources held by the widget.
   */
  dispose() {
    // Do nothing if already disposed.
    if (this.isDisposed) {
      return;
    }
    this._history.dispose();
    this._history = null;
    this._completionHandler.dispose();
    this._completionHandler = null;
    this._completion.dispose();
    this._completion = null;
    this._session.dispose();
    this._session = null;
    super.dispose();
  }

  /**
   * Execute the current prompt.
   */
  execute(): Promise<void> {
    this.dismissCompletion();

    if (this._session.status === 'dead') {
      this.updateDetails(null);
      return;
    }

    let prompt = this.prompt;
    prompt.trusted = true;
    this._history.push(prompt.model.source);
    // Create a new prompt before kernel execution to allow typeahead.
    this.newPrompt();
    return prompt.execute(this._session.kernel).then(
      (value: KernelMessage.IExecuteReplyMsg) => {
        if (!value) {
          this.updateDetails(null);
          return;
        }
        if (value.content.status === 'ok') {
          let content = value.content as KernelMessage.IExecuteOkReply;
          this.updateDetails(content);
        }
        Private.scrollToBottom(this.node);
      },
      () => { Private.scrollToBottom(this.node); }
    );
  }

  /**
   * Clear the code cells.
   */
  clear(): void {
    while (this.prompt) {
      this.prompt.dispose();
    }
    this.newPrompt();
  }

  /**
   * Dismiss the completion widget for a console.
   */
  dismissCompletion(): void {
    this._completion.reset();
  }

  /**
   * Serialize the output.
   */
  serialize(): nbformat.ICodeCell[] {
    let output: nbformat.ICodeCell[] = [];
    let layout = this.layout as PanelLayout;
    for (let i = 1; i < layout.childCount(); i++) {
      let widget = layout.childAt(i) as CodeCellWidget;
      output.push(widget.model.toJSON());
    }
    return output;
  }

  /**
   * Handle the DOM events for the widget.
   *
   * @param event - The DOM event sent to the widget.
   *
   * #### Notes
   * This method implements the DOM `EventListener` interface and is
   * called in response to events on the dock panel's node. It should
   * not be called directly by user code.
   */
  handleEvent(event: Event): void {
    switch (event.type) {
    case 'click':
      let prompt = this.prompt;
      if (prompt) {
        prompt.focus();
      }
      break;
    default:
      break;
    }
  }

  /**
   * Handle `after_attach` messages for the widget.
   */
  protected onAfterAttach(msg: Message): void {
    this.node.addEventListener('click', this);
    let prompt = this.prompt;
    if (prompt) {
      prompt.focus();
    }
  }

  /**
   * Handle `before_detach` messages for the widget.
   */
  protected onBeforeDetach(msg: Message): void {
    this.node.removeEventListener('click', this);
  }

  /**
   * Handle an edge requested signal.
   */
  protected onEdgeRequest(editor: CellEditorWidget, location: EdgeLocation): void {
    let prompt = this.prompt;
    if (location === 'top') {
      this._history.back().then(value => {
        if (!value) {
          return;
        }
        prompt.model.source = value;
        prompt.editor.setCursorPosition(0);
      });
    } else {
      this._history.forward().then(value => {
        // If at the bottom end of history, then clear the prompt.
        let text = value || '';
        prompt.model.source = text;
        prompt.editor.setCursorPosition(text.length);
      });
    }
  }

  /**
   * Handle a text changed signal from an editor.
   *
   * #### Notes
   * Update the hints inspector based on a text change.
   */
  protected onTextChange(editor: CellEditorWidget, change: ITextChange): void {
    let inspectorUpdate: ConsoleWidget.IInspectorUpdate = {
      content: null,
      type: 'hints'
    };

    // Clear hints if the new text value is empty.
    if (!change.newValue) {
      this.inspected.emit(inspectorUpdate);
      return;
    }

    let contents: KernelMessage.IInspectRequest = {
      code: change.newValue,
      cursor_pos: change.position,
      detail_level: 0
    };
    let pendingInspect = ++this._pendingInspect;

    this._session.kernel.inspect(contents).then(msg => {
      let value = msg.content;

      // If widget has been disposed, bail.
      if (this.isDisposed) {
        this.inspected.emit(inspectorUpdate);
        return;
      }

      // If a newer text change has created a pending request, bail.
      if (pendingInspect !== this._pendingInspect) {
        this.inspected.emit(inspectorUpdate);
        return;
      }

      // Hint request failures or negative results fail silently.
      if (value.status !== 'ok' || !value.found) {
        this.inspected.emit(inspectorUpdate);
        return;
      }

      let bundle = value.data as MimeMap<string>;
      this._rendermime.render(bundle, true).then(content => {
        inspectorUpdate.content = content;
        this.inspected.emit(inspectorUpdate);
      });
    });
  }

  /**
   * Handle `update_request` messages.
   */
  protected onUpdateRequest(msg: Message): void {
    let prompt = this.prompt;
    Private.scrollIfNeeded(this.parent.node, prompt.node);
  }

  /**
   * Initialize the banner and mimetype.
   */
  protected initialize(): void {
    let layout = this.layout as PanelLayout;
    let banner = layout.childAt(0) as RawCellWidget;
    this._session.kernel.kernelInfo().then(msg => {
      let info = msg.content;
      banner.model.source = info.banner;
      this._mimetype = mimetypeForLanguage(info.language_info);
      this.prompt.mimetype = this._mimetype;
    });
  }

  /**
   * Make a new prompt.
   */
  protected newPrompt(): void {
    // Make the previous editor read-only and clear its signals.
    let prompt = this.prompt;
    if (prompt) {
      prompt.readOnly = true;
      prompt.removeClass(PROMPT_CLASS);
      clearSignalData(prompt.editor);
    }

    // Create the new prompt and add to layout.
    let layout = this.layout as PanelLayout;
    prompt = this._renderer.createPrompt(this._rendermime);
    prompt.mimetype = this._mimetype;
    prompt.addClass(PROMPT_CLASS);
    layout.addChild(prompt);

    // Hook up completion, hints, and history handling.
    let editor = prompt.editor;
    editor.textChanged.connect(this.onTextChange, this);
    editor.edgeRequested.connect(this.onEdgeRequest, this);

    // Associate the new prompt with the completion handler.
    this._completionHandler.activeCell = prompt;

    // Jump to the bottom of the console.
    Private.scrollToBottom(this.node);

    // Clear the hints inspector.
    this.inspected.emit({ content: null, type: 'hints' });

    prompt.focus();
  }

  /**
   * Update the details inspector based on a kernel response.
   *
   * #### Notes
   * Payloads are deprecated and there are no official interfaces for them in
   * the kernel type definitions.
   * See [Payloads (DEPRECATED)](http://jupyter-client.readthedocs.io/en/latest/messaging.html#payloads-deprecated).
   */
  protected updateDetails(content: KernelMessage.IExecuteOkReply): void {
    let inspectorUpdate: ConsoleWidget.IInspectorUpdate = {
      content: null,
      type: 'details'
    };

    if (!content) {
      this.inspected.emit(inspectorUpdate);
      return;
    }

    let details = content.payload.filter(i => (i as any).source === 'page')[0];
    if (details) {
      let bundle = (details as any).data as MimeMap<string>;
      this._rendermime.render(bundle, true).then(content => {
        inspectorUpdate.content = content;
        this.inspected.emit(inspectorUpdate);
      });
      return;
    }

    this.inspected.emit(inspectorUpdate);
  }

  private _completion: CompletionWidget = null;
  private _completionHandler: CellCompletionHandler = null;
  private _mimetype = 'text/x-ipython';
  private _rendermime: RenderMime = null;
  private _renderer: ConsoleWidget.IRenderer = null;
  private _history: IConsoleHistory = null;
  private _session: ISession = null;
  private _pendingInspect = 0;
}

/**
 * A namespace for ConsoleWidget statics.
 */
export
namespace ConsoleWidget {
  /**
   * The initialization options for a console widget.
   */
  export
  interface IOptions {
    /**
     * The completion widget for a console widget.
     */
    completion?: CompletionWidget;

    /**
     * The mime renderer for the console widget.
     */
    rendermime: RenderMime;

    /**
     * The renderer for a console widget.
     */
    renderer?: IRenderer;

    /**
     * The session for the console widget.
     */
    session: ISession;
  }

  /**
   * A renderer for completion widget nodes.
   */
  export
  interface IRenderer {
    /**
     * Create a new banner widget.
     */
    createBanner(): RawCellWidget;

    /**
     * Create a new prompt widget.
     */
    createPrompt(rendermime: RenderMime): CodeCellWidget;
  }


  /**
   * An update value for console code inspectors.
   */
  export
  interface IInspectorUpdate {
    /**
     * The content being sent to the inspector for display.
     */
    content: Widget;

    /**
     * The type of the inspector being updated.
     */
    type: string;
  }


  /**
   * The default implementation of an `IRenderer`.
   */
  export
  class Renderer implements IRenderer {
    /**
     * Create a new banner widget.
     */
    createBanner(): RawCellWidget {
      let widget = new RawCellWidget();
      widget.model = new RawCellModel();
      return widget;
    }

    /**
     * Create a new prompt widget.
     */
    createPrompt(rendermime: RenderMime): CodeCellWidget {
      let widget = new CodeCellWidget({ rendermime });
      widget.model = new CodeCellModel();
      return widget;
    }
  }


  /**
   * The default `IRenderer` instance.
   */
  export
  const defaultRenderer = new Renderer();
}


/**
 * A namespace for console widget private data.
 */
namespace Private {
  /**
   * A signal emitted when an inspector value is generated.
   */
  export
  const inspectedSignal = new Signal<ConsoleWidget, ConsoleWidget.IInspectorUpdate>();

  /**
   * Scroll an element into view if needed.
   *
   * @param area - The scroll area element.
   *
   * @param elem - The element of interest.
   */
  export
  function scrollIfNeeded(area: HTMLElement, elem: HTMLElement): void {
    let ar = area.getBoundingClientRect();
    let er = elem.getBoundingClientRect();
    if (er.top < ar.top - 10) {
      area.scrollTop -= ar.top - er.top + 10;
    } else if (er.bottom > ar.bottom + 10) {
      area.scrollTop += er.bottom - ar.bottom + 10;
    }
  }

  /**
   * Jump to the bottom of a node.
   *
   * @param node - The scrollable element.
   */
  export
  function scrollToBottom(node: HTMLElement): void {
    node.scrollTop = node.scrollHeight;
  }
}
