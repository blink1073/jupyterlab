// Copyright (c) Jupyter Development Team.
// Distributed under the terms of the Modified BSD License.

import {
  IRenderMime
} from '@jupyterlab/rendermime-interfaces';


/**
 *
 */
export
function mimeReducer(state: IRenderMime.IMimeStoreState, action: IRenderMime.RenderMimeAction): IRenderMime.IMimeStoreState {
  return {
    ...state,
    mimeModels: mimeModels(state.mimeModels, action),
    mimeBundles: mimeBundles(state.mimeBundles, action),
  };
}



function mimeModels(table: IRenderMime.ITable<IRenderMime.IMimeModel>, action: IRenderMime.RenderMimeAction): IRenderMime.ITable<IRenderMime.IMimeModel> {
  switch (action.type) {
  case '@jupyterlab/rendermime-interfaces/CREATE_MIME_MODEL':
    return createNewEntry(table, action.id, action.model);
  default:
    return table;
  }
}


function mimeBundles(table: IRenderMime.ITable<IRenderMime.IMimeBundle>, action: IRenderMime.RenderMimeAction): IRenderMime.ITable<IRenderMime.IMimeBundle> {
  let entry: IRenderMime.IMimeBundle;
  switch (action.type) {
  case '@jupyterlab/rendermime-interfaces/CREATE_MIME_BUNDLE':
    return createNewEntry(table, action.id, action.bundle);
  case '@jupyterlab/rendermime-interfaces/ADD_TO_MIME_BUNDLE':
    entry = { ...table.byId[action.id], [action.key]: action.value };
    return {
      ...table,
      byId: { ...table.byId, [action.id]: entry }
    };
  case '@jupyterlab/rendermime-interfaces/REMOVE_FROM_MIME_BUNDLE':
    entry = { ...table.byId[action.id] };
    delete (entry as any)[action.key];
    return {
      ...table,
      byId: { ...table.byId, [action.id]: entry }
    };
  default:
    return table;
  }
}


/**
 *
 */
function createNewEntry<T>(table: IRenderMime.ITable<T>, id: number, entry: T): IRenderMime.ITable<T> {
  if (id in table.byId) {
    throw new Error(`Id '${id}' already exists.`);
  }

  return { ...table, maxId: maxId(table.maxId), byId: byId(table.byId) };

  function byId(map: IRenderMime.IByIdMap<T>): IRenderMime.IByIdMap<T> {
    return { ...map, [id]: entry };
  }

  function maxId(maxId: number): number {
    return Math.max(maxId, id);
  }
}
