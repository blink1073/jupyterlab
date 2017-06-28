
import {
  CodeEditor
} from '@jupyterlab/codeeditor';

import {
  nbformat
} from '@jupyterlab/coreutils';

import {
  JSONObject
} from '@phosphor/coreutils';

import {
  Action, Table
} from '@phosphor/datastore';



/**
 * A code editor model.
 */
interface ICodeEditorModel {
  /**
   * The value of the code.
   */
  value: string;

  /**
   * The changes associated with the value.
   */
  changesId: string;

  /**
   * The selections associated with the cell.
   */
  selectionsId: string;

  /**
   * The mime type of the cell.
   */
  mimeType: string;
}


/**
 * A cell model.
 */
interface ICellModel extends ICodeEditorModel {
  /**
   * The type of the cell.
   */
  type: nbformat.CellType;

  /**
   * Whether the cell is trusted.
   */
  trusted: boolean;

  /**
   * The metadata for the cell.
   */
  metadataId: string;

  /**
   * The output area for the cell.
   */
  outputAreaId: string;
}


export
interface IOutputStoreState {

}


export
interface ISelectionMap {
  readonly [key: string]: CodeEditor.ITextSelection[];
}


export
interface ITextChange extends JSONObject {
  type: 'insert' | 'remove' | 'set';
  start: number;
  end: number;
  value: string;
}


/**
 * The data type for a cell store.
 */
export
interface ICellStoreState extends IOutputStoreState {
  /**
   * The cell models table.
   */
  readonly cells: Table.RecordTable<ICellModel>;

  /**
   * The cell metadata table.
   */
  readonly cellMetadata: Table.JSONTable<JSONObject>;

  /**
   * The cell selections table.
   */
  readonly cellSelections: Table.JSONTable<ISelectionMap>;

  /**
   * The cell value change table.
   */
  readonly cellValueChanges: Table.JSONTable<ITextChange[]>;
}


/**
 * An action for creating a new cell model.
 */
export
class CreateCellModel extends Action<'@jupyterlab/cells/CREATE_CELL_MODEL'> {
  /**
   * Construct a new action.
   *
   * @param modelId - The unique id to use for the mime model.
   *
   * @param model - The initial state for the mime model.
   */
  constructor(
    public readonly modelId: string,
    public readonly model: ICellModel) {
    super('@jupyterlab/cells/CREATE_CELL_MODEL');
  }
}


/**
 * An action for removing a cell model.
 */
export
class RemoveCellModel extends Action<'@jupyterlab/cells/REMOVE_CELL_MODEL'> {
  /**
   * Construct a new action.
   *
   * @param modelId - The unique id to use for the mime model.
   */
  constructor(
    public readonly modelId: string) {
    super('@jupyterlab/cells/REMOVE_CELL_MODEL');
  }
}


/**
 * An action for creating a new cell metadata.
 */
export
class CreateCellMetadata extends Action<'@jupyterlab/cells/CREATE_CELL_METADATA'> {
  /**
   * Construct a new action.
   *
   * @param modelId - The unique id of the cell metadata.
   *
   * @param data - The initial data for the metadata.
   */
  constructor(
    public readonly modelId: string,
    public readonly data: JSONObject) {
    super('@jupyterlab/cells/CREATE_CELL_METADATA');
  }
}


/**
 * An action for adding or updating cell metadata.
 */
export
class AddCellMetadata extends Action<'@jupyterlab/cells/ADD_CELL_METADATA'> {
  /**
   * Construct a new action.
   *
   * @param modelId - The unique id of the cell metadata.
   *
   * @param key - The key to add.
   *
   * @param value - The data for the key.
   */
  constructor(
    public readonly modelId: string,
    public readonly key: string,
    public readonly data: JSONObject) {
    super('@jupyterlab/cells/ADD_CELL_METADATA');
  }
}


/**
 * An action for removing cell metadata.
 */
export
class RemoveCellMetadata extends Action<'@jupyterlab/cells/REMOVE_CELL_METADATA'> {
  /**
   * Construct a new action.
   *
   * @param modelId - The unique id of the cell metadata.
   *
   * @param key - The key to remove.
   */
  constructor(
    public readonly modelId: string,
    public readonly key: string) {
    super('@jupyterlab/cells/REMOVE_CELL_METADATA');
  }
}


/**
 * An action for setting the cell mime type.
 */
export
class SetCellMimeType extends Action<'@jupyterlab/cells/SET_CELL_MIMETYPE'> {
  /**
   * Construct a new action.
   *
   * @param modelId - The unique id of the cell.
   *
   * @param mimeType - The mime type to set.
   */
  constructor(
    public readonly modelId: string,
    public readonly mimeType: string) {
    super('@jupyterlab/cells/SET_CELL_MIMETYPE');
  }
}


/**
 * An action for setting the cell trusted state.
 */
export
class SetCellTrusted extends Action<'@jupyterlab/cells/SET_CELL_TRUSTED'> {
  /**
   * Construct a new action.
   *
   * @param modelId - The unique id of the cell.
   *
   * @param trusted - The trust value to set.
   */
  constructor(
    public readonly modelId: string,
    public readonly trusted: string) {
    super('@jupyterlab/cells/SET_CELL_TRUSTED');
  }
}


/**
 * An action for changing the cell source.
 */
export
class ChangeCellSource extends Action<'@jupyterlab/cells/CHANGE_CELL_SOURCE'> {
  /**
   * Construct a new action.
   *
   * @param modelId - The unique id of the cell.
   *
   * @param change - The text change.
   */
  constructor(
    public readonly modelId: string,
    public readonly change: ITextChange) {
    super('@jupyterlab/cells/CHANGE_CELL_SOURCE');
  }
}


/**
 * An action for creating a new cell selections object.
 */
export
class CreateCellSelections extends Action<'@jupyterlab/cells/CREATE_CELL_SELECTIONS'> {
  /**
   * Construct a new action.
   *
   * @param modelId - The unique id of the cell selections.
   *
   * @param data - The initial data for the selections.
   */
  constructor(
    public readonly modelId: string,
    public readonly data: ISelectionMap) {
    super('@jupyterlab/cells/CREATE_CELL_SELECTIONS');
  }
}


/**
 * An action for adding or updating cell selections.
 */
export
class AddCellSelections extends Action<'@jupyterlab/cells/ADD_CELL_SELECTIONS'> {
  /**
   * Construct a new action.
   *
   * @param modelId - The unique id of the cell metadata.
   *
   * @param key - The key to add.
   *
   * @param value - The data for the key.
   */
  constructor(
    public readonly modelId: string,
    public readonly key: string,
    public readonly data: CodeEditor.ITextSelection[]) {
    super('@jupyterlab/cells/ADD_CELL_SELECTIONS');
  }
}


/**
 * An action for removing cell selections.
 */
export
class RemoveCellSelections extends Action<'@jupyterlab/cells/REMOVE_CELL_SELECTIONS'> {
  /**
   * Construct a new action.
   *
   * @param modelId - The unique id of the cell selections.
   *
   * @param key - The key to remove.
   */
  constructor(
    public readonly modelId: string,
    public readonly key: string) {
    super('@jupyterlab/cells/REMOVE_CELL_SELECTIONS');
  }
}


/**
 * The data type for a notebook store.
 */
export
interface INotebookStoreState extends ICellStoreState {
  /**
   * The cell list.
   */
  readonly cellList: ReadonlyArray<string>;

  /**
   * The notebook metadata.
   */
  readonly notebookMetadata: JSONObject;

  /**
   * The major version number of the nbformat.
   */
  readonly nbformat: number;

  /**
   * The minor version number of the nbformat.
   */
  readonly nbformatMinor: number;
}
