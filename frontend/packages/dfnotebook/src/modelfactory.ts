// Copyright (c) Jupyter Development Team.
// Distributed under the terms of the Modified BSD License.

import { DataflowNotebookModel } from './model';
import { INotebookModel, NotebookModelFactory } from '@jupyterlab/notebook';
import type { ISharedNotebook } from '@jupyter/ydoc';
import { DocumentRegistry } from '@jupyterlab/docregistry';

/**
 * A model factory for notebooks.
 */
export class DataflowNotebookModelFactory extends NotebookModelFactory {

  /**
   * Create a new model for a given path.
   *
   * @param languagePreference - An optional kernel language preference.
   *
   * @returns A new document model.
   */
  createNew(
    options: DocumentRegistry.IModelOptions<ISharedNotebook> = {}
  ): INotebookModel {
    return new DataflowNotebookModel({
      languagePreference: options.languagePreference,
      sharedModel: options.sharedModel,
      collaborationEnabled: options.collaborationEnabled && this.collaborative,
      //@ts-ignore
      disableDocumentWideUndoRedo: this._disableDocumentWideUndoRedo
    });
  }

  /**
   * The name of the model.
   */
   get name(): string {
    return 'dfnotebook';
  }

  // FIXME: Can only assign to notebook | file | directory
  //
  // /**
  //  * The content type of the file.
  //  */
  // get contentType(): Contents.ContentType {
  //   return 'dfnotebook';
  // }  
}

export namespace DataflowNotebookModelFactory {
  export interface IFactory extends DocumentRegistry.IModelFactory<INotebookModel> {

  }
}