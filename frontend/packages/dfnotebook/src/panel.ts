// Copyright (c) Jupyter Development Team.
// Distributed under the terms of the Modified BSD License.

import { Notebook, NotebookPanel } from '@jupyterlab/notebook';
import { DataflowNotebook } from './widget';
/**
 * A namespace for `DataflowNotebookPanel` statics.
 */
export namespace DataflowNotebookPanel {
  export interface IContentFactory extends NotebookPanel.IContentFactory {

  }

  /**
   * The default implementation of an `IContentFactory`.
   */
  export class ContentFactory extends DataflowNotebook.ContentFactory implements IContentFactory {
    /**
     * Create a new content area for the panel.
     */
    createNotebook(options: Notebook.IOptions): Notebook {
      console.log("CALLING CREATE DATAFLOW NOTEBOOK!", options);
      return new DataflowNotebook(options);
    }
  }

  /**
   * Default content factory for the notebook panel.
   */
  export const defaultContentFactory: ContentFactory = new ContentFactory();
}
