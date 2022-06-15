// Copyright (c) Jupyter Development Team.
// Distributed under the terms of the Modified BSD License.

import { DataflowNotebookModel } from './model';
import { NotebookModelFactory } from '@jupyterlab/notebook';

/**
 * A model factory for notebooks.
 */
export class DataflowNotebookModelFactory extends NotebookModelFactory {
  /**
   * Construct a new notebook model factory.
   */
  constructor(options: NotebookModelFactory.IOptions) {
    super({contentFactory: DataflowNotebookModel.defaultContentFactory, ...options});
  }

  // /**
  //  * Create a new model for a given path.
  //  *
  //  * @param languagePreference - An optional kernel language preference.
  //  *
  //  * @returns A new document model.
  //  */
  // createNew(
  //   languagePreference?: string,
  //   modelDB?: IModelDB,
  //   isInitialized?: boolean
  // ): INotebookModel {
  //   const contentFactory = this.contentFactory;
  //   return new DataflowNotebookModel({
  //     languagePreference,
  //     contentFactory,
  //     modelDB,
  //     isInitialized,
  //     //@ts-ignore
  //     disableDocumentWideUndoRedo: this._disableDocumentWideUndoRedo
  //   });
  // }

}
