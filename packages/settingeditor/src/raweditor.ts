// Copyright (c) Jupyter Development Team.
// Distributed under the terms of the Modified BSD License.

import {
  Toolbar
} from '@jupyterlab/apputils';

import {
  CodeEditor, CodeEditorWrapper
} from '@jupyterlab/codeeditor';

import {
  ISettingRegistry
} from '@jupyterlab/coreutils';

import {
  CommandRegistry
} from '@phosphor/commands';

import {
  Message
} from '@phosphor/messaging';

import {
  ISignal, Signal
} from '@phosphor/signaling';

import {
  h, VirtualDOM
} from '@phosphor/virtualdom';

import {
  BoxLayout, Widget
} from '@phosphor/widgets';

import {
  SplitPanel
} from './splitpanel';


/**
 * A class name added to all raw editors.
 */
const RAW_EDITOR_CLASS = 'jp-SettingsRawEditor';

/**
 * A class name added to the user settings editor.
 */
const USER_CLASS = 'jp-SettingsRawEditor-user';

/**
 * A class name added to the user editor when there are validation errors.
 */
const ERROR_CLASS = 'jp-mod-error';

/**
 * The banner text for the default editor.
 */
const DEFAULT_TITLE = 'System Defaults';

/**
 * The banner text for the user settings editor.
 */
const USER_TITLE = 'User Overrides';


/**
 * A raw JSON settings editor.
 */
export
class RawEditor extends SplitPanel {
  /**
   * Create a new plugin editor.
   */
  constructor(options: RawEditor.IOptions) {
    super({
      orientation: 'horizontal',
      renderer: SplitPanel.defaultRenderer,
      spacing: 1
    });

    const { commands, editorFactory } = options;

    this._commands = commands;

    // Create read-only defaults editor.
    const defaults = this._defaults = new CodeEditorWrapper({
      model: new CodeEditor.Model(),
      factory: editorFactory
    });

    defaults.editor.model.value.text = '';
    defaults.editor.model.mimeType = 'text/javascript';
    defaults.editor.setOption('readOnly', true);

    // Create read-write user settings editor.
    const user = this._user = new CodeEditorWrapper({
      model: new CodeEditor.Model(),
      factory: editorFactory,
      config: { lineNumbers: true }
    });

    user.addClass(USER_CLASS);
    user.editor.model.mimeType = 'text/javascript';
    user.editor.model.value.changed.connect(this._onTextChanged, this);

    this.addClass(RAW_EDITOR_CLASS);
    this._onSaveError = options.onSaveError;
    this.addWidget(Private.wrapEditor(defaults, DEFAULT_TITLE));
    this.addWidget(Private.wrapEditor(user, USER_TITLE, this._toolbar));
  }

  /**
   * Whether the raw editor debug functionality is enabled.
   */
  get canDebug(): boolean {
    return this._canDebug;
  }

  /**
   * Whether the raw editor revert functionality is enabled.
   */
  get canRevert(): boolean {
    return this._canRevert;
  }

  /**
   * Whether the raw editor save functionality is enabled.
   */
  get canSave(): boolean {
    return this._canSave;
  }

  /**
   * Emits when the commands passed in at instantiation change.
   */
  get commandsChanged(): ISignal<any, string[]> {
    return this._commandsChanged;
  }

  /**
   * Tests whether the settings have been modified and need saving.
   */
  get isDirty(): boolean {
    return this._user.editor.model.value.text !== this._settings.raw;
  }

  /**
   * The plugin settings being edited.
   */
  get settings(): ISettingRegistry.ISettings | null {
    return this._settings;
  }
  set settings(settings: ISettingRegistry.ISettings | null) {
    if (!settings && !this._settings) {
      return;
    }

    const samePlugin = (settings && this._settings) &&
      settings.plugin === this._settings.plugin;

    if (samePlugin) {
      return;
    }

    const defaults = this._defaults;
    const user = this._user;

    // Disconnect old settings change handler.
    if (this._settings) {
      this._settings.changed.disconnect(this._onSettingsChanged, this);
    }

    if (settings) {
      this._settings = settings;
      this._settings.changed.connect(this._onSettingsChanged, this);
      this._onSettingsChanged();
    } else {
      this._settings = null;
      defaults.editor.model.value.text = '';
      user.editor.model.value.text = '';
    }

    this.update();
  }

  /**
   * Get the relative sizes of the two editor panels.
   */
  get sizes(): number[] {
    return this.relativeSizes();
  }
  set sizes(sizes: number[]) {
    this.setRelativeSizes(sizes);
  }

  /**
   * The inspectable source editor for user input.
   */
  get source(): CodeEditor.IEditor {
    return this._user.editor;
  }

  /**
   * Dispose of the resources held by the raw editor.
   */
  dispose(): void {
    if (this.isDisposed) {
      return;
    }

    super.dispose();
    this._defaults.dispose();
    this._user.dispose();
  }

  /**
   * Handle `after-attach` messages.
   */
  protected onAfterAttach(msg: Message): void {
    Private.populateToolbar(this._commands, this._toolbar);
    this.update();
  }

  /**
   * Handle `'update-request'` messages.
   */
  protected onUpdateRequest(msg: Message): void {
    const settings = this._settings;
    const defaults = this._defaults;
    const user = this._user;

    if (settings) {
      defaults.editor.refresh();
      user.editor.refresh();
    }
  }

  /**
   * Handle text changes in the underlying editor.
   */
  private _onTextChanged(): void {
    const raw = this._user.editor.model.value.text;
    const settings = this._settings;

    this.removeClass(ERROR_CLASS);

    if (!raw || !settings || settings.raw === raw) {
      this._updateToolbar(false, false, false);
      return;
    }

    const errors = settings.validate(raw);

    if (errors) {
      this.addClass(ERROR_CLASS);
      this._updateToolbar(true, true, false);
      return;
    }

    this._updateToolbar(false, true, true);
  }

  /**
   * Handle updates to the settings.
   */
  private _onSettingsChanged(): void {
    const settings = this._settings;
    const defaults = this._defaults;
    const user = this._user;

    defaults.editor.model.value.text = settings.annotatedDefaults();
    user.editor.model.value.text = settings.raw;
  }

  private _updateToolbar(debug: boolean, revert: boolean, save: boolean): void {
    const commands = this._commands;

    this._canDebug = debug;
    this._canRevert = revert;
    this._canSave = save;
    this._commandsChanged.emit([
      commands.debug,
      commands.revert,
      commands.save
    ]);
  }

  private _canDebug = false;
  private _canRevert = false;
  private _canSave = false;
  private _commandsChanged = new Signal<this, string[]>(this);
  private _commands: RawEditor.ICommandBundle;
  private _defaults: CodeEditorWrapper;
  private _onSaveError: (reason: any) => void;
  private _settings: ISettingRegistry.ISettings | null = null;
  private _toolbar: Toolbar<Widget> = new Toolbar();
  private _user: CodeEditorWrapper;
}


/**
 * A namespace for `RawEditor` statics.
 */
export
namespace RawEditor {
  /**
   * The toolbar commands and registry for the setting editor toolbar.
   */
  export
  interface ICommandBundle {
    /**
     * The command registry.
     */
    registry: CommandRegistry;

    /**
     * The debug command ID.
     */
    debug: string;

    /**
     * The revert command ID.
     */
    revert: string;

    /**
     * The save command ID.
     */
    save: string;
  }

  /**
   * The instantiation options for a raw editor.
   */
  export
  interface IOptions {
    /**
     * The toolbar commands and registry for the setting editor toolbar.
     */
    commands: ICommandBundle;

    /**
     * The editor factory used by the raw editor.
     */
    editorFactory: CodeEditor.Factory;

    /**
     * A function the raw editor calls on save errors.
     */
    onSaveError: (reason: any) => void;
  }
}


/**
 * A namespace for private module data.
 */
namespace Private {
  /**
   * Populate the raw editor toolbar.
   */
  export
  function populateToolbar(commands: RawEditor.ICommandBundle, toolbar: Toolbar<Widget>): void {
    const { debug, registry, revert, save } = commands;

    toolbar.addItem('spacer', Toolbar.createSpacerItem());

    // Note the button order. The rationale here is that no matter what state
    // the toolbar is in, the relative location of the revert button in the
    // toolbar remains the same.
    [revert, debug, save].forEach(name => {
      const item = Toolbar.createFromCommand(registry, name);

      if (item) {
        toolbar.addItem(name, item);
      }
    });
  }

  /**
   * Returns a wrapper widget to hold an editor and its banner.
   */
  export
  function wrapEditor(editor: Widget, bannerText: string, toolbar?: Toolbar<Widget>): Widget {
    const widget = new Widget();
    const layout = widget.layout = new BoxLayout({ spacing: 0 });
    const banner = new Widget({ node: VirtualDOM.realize(h.div(bannerText)) });

    if (toolbar) {
      toolbar.insertItem(0, 'banner', banner);
      layout.addWidget(toolbar);
    } else {
      // If a toolbar is not passed in, create a toolbar that only has the
      // banner text in it.
      const bar = new Toolbar();

      bar.insertItem(0, 'banner', banner);
      layout.addWidget(bar);
    }

    layout.addWidget(editor);

    return widget;
  }
}
