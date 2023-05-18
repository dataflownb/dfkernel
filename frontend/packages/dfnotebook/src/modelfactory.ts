// Copyright (c) Jupyter Development Team.
// Distributed under the terms of the Modified BSD License.

import { DataflowNotebookModel } from './model';
import { INotebookModel, NotebookModelFactory } from '@jupyterlab/notebook';
import { IModelDB } from '@jupyterlab/observables';
import { DocumentRegistry } from '@jupyterlab/docregistry';

/**
 * A model factory for notebooks.
 */
export class DataflowNotebookModelFactory extends NotebookModelFactory {
  /**
   * Construct a new notebook model factory.
   */
  constructor(options: NotebookModelFactory.IOptions) {
    super({contentFactory: new DataflowNotebookModel.ContentFactory({
      codeCellContentFactory: options.codeCellContentFactory}), 
      ...options});
  }

  /**
   * Create a new model for a given path.
   *
   * @param languagePreference - An optional kernel language preference.
   *
   * @returns A new document model.
   */
  createNew(
    languagePreference?: string,
    modelDB?: IModelDB,
    isInitialized?: boolean
  ): INotebookModel {
    const contentFactory = this.contentFactory;
    return new DataflowNotebookModel({
      languagePreference,
      contentFactory,
      modelDB,
      isInitialized,
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