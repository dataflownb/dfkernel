// Copyright (c) Jupyter Development Team.
// Distributed under the terms of the Modified BSD License.

import { Notebook, NotebookPanel } from '@jupyterlab/notebook';
import { DataflowNotebook } from './widget';
import { Token } from '@lumino/coreutils';
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
      return new DataflowNotebook(options);
    }
  }

  /**
   * The notebook renderer token.
   */
  export const IContentFactory = new Token<IContentFactory>(
    '@dfnotebook/dfnotebook:IContentFactory',
    `A factory object that creates new dataflow notebooks.
    Use this if you want to create and host dataflow notebooks in your own UI elements.`
  )
}


