// Copyright (c) Jupyter Development Team.
// Distributed under the terms of the Modified BSD License.

import {
  Cell,
  CodeCell,
  MarkdownCell,
  RawCell,
} from '@jupyterlab/cells';
import { StaticNotebook, Notebook } from '@jupyterlab/notebook';

import {
  DataflowCodeCell,
  DataflowMarkdownCell,
  DataflowRawCell
} from '@dfnotebook/dfcells';


/**
 * The namespace for the `StaticNotebook` class statics.
 */
export namespace DataflowStaticNotebook {

  /**
   * The default implementation of an `IContentFactory`.
   */
  export class ContentFactory
    extends Cell.ContentFactory
    implements StaticNotebook.IContentFactory {
    /**
     * Create a new code cell widget.
     *
     * #### Notes
     * If no cell content factory is passed in with the options, the one on the
     * notebook content factory is used.
     */
    createCodeCell(
      options: CodeCell.IOptions,
      parent: StaticNotebook
    ): CodeCell {
      if (!options.contentFactory) {
        options.contentFactory = this;
      }
      return new DataflowCodeCell(options).initializeState();
    }

    /**
     * Create a new markdown cell widget.
     *
     * #### Notes
     * If no cell content factory is passed in with the options, the one on the
     * notebook content factory is used.
     */
    createMarkdownCell(
      options: MarkdownCell.IOptions,
      parent: StaticNotebook
    ): MarkdownCell {
      if (!options.contentFactory) {
        options.contentFactory = this;
      }
      return new DataflowMarkdownCell(options).initializeState();
    }

    /**
     * Create a new raw cell widget.
     *
     * #### Notes
     * If no cell content factory is passed in with the options, the one on the
     * notebook content factory is used.
     */
    createRawCell(options: RawCell.IOptions, parent: StaticNotebook): RawCell {
      if (!options.contentFactory) {
        options.contentFactory = this;
      }
      return new DataflowRawCell(options).initializeState();
    }
  }

  /**
   * Default content factory for the static notebook widget.
   */
  export const defaultContentFactory: StaticNotebook.IContentFactory = new ContentFactory();
}

export class DataflowNotebook extends Notebook {
  constructor(options: Notebook.IOptions) {
    super({contentFactory: DataflowNotebook.defaultContentFactory, ...options});
  }
}

export namespace DataflowNotebook {
  /**
   * The default implementation of a notebook content factory..
   *
   * #### Notes
   * Override methods on this class to customize the default notebook factory
   * methods that create notebook content.
   */
  export class ContentFactory extends DataflowStaticNotebook.ContentFactory {}

  export const defaultContentFactory: Notebook.IContentFactory = new ContentFactory();
}
