// Copyright (c) Jupyter Development Team.
// Distributed under the terms of the Modified BSD License.

import {
  CellModel,
  CodeCellModel,
  ICodeCellModel,
  IMarkdownCellModel,
  IRawCellModel
} from '@jupyterlab/cells';
import { NotebookModel } from '@jupyterlab/notebook';
import * as nbformat from '@jupyterlab/nbformat';
import { UUID } from '@lumino/coreutils';

import {
  DataflowCodeCellModel,
  DataflowMarkdownCellModel,
  DataflowRawCellModel
} from '@dfnotebook/dfcells';
import { IModelDB } from '@jupyterlab/observables';


export class DataflowNotebookModel extends NotebookModel {
  constructor(options: NotebookModel.IOptions = {}) {
    super({contentFactory: DataflowNotebookModel.defaultContentFactory, ...options});
  }

  /**
   * The name of the model.
   */
   get name(): string {
    return 'dfnotebook';
  }

  fromJSON(value: nbformat.INotebookContent): void {
    let isDataflow = true;
    if (value.metadata?.kernelspec?.name && value.metadata.kernelspec.name != 'dfpython3') {
      //@ts-expect-error
      this.contentFactory = NotebookModel.defaultContentFactory;
      isDataflow = false;
    }
    super.fromJSON(value);
    this.metadata.set('dfnotebook', isDataflow);
  }

}

/**
 * The namespace for the `NotebookModel` class statics.
 */
export namespace DataflowNotebookModel {
  /**
   * The dataflow implementation of an `IContentFactory`.
   */
  export class ContentFactory extends NotebookModel.ContentFactory {
    /*
     * FIXME: Add codeCellContentFactory default to DataflowCodeCellContentFactory??
     */
    constructor(options: NotebookModel.ContentFactory.IOptions) {
      super(options);
    }

    /**
     * Create a new code cell.
     *
     * @param source - The data to use for the original source data.
     *
     * @returns A new code cell. If a source cell is provided, the
     *   new cell will be initialized with the data from the source.
     *   If the contentFactory is not provided, the instance
     *   `codeCellContentFactory` will be used.
     */
    createCodeCell(options: CodeCellModel.IOptions): ICodeCellModel {
      if (options.contentFactory) {
        options.contentFactory = this.codeCellContentFactory;
      }
      if (this.modelDB) {
        if (!options.id) {
          options.id = UUID.uuid4();
        }
        options.modelDB = this.modelDB.view(options.id);
      }
      return new DataflowCodeCellModel(options);
    }

    /**
     * Create a new markdown cell.
     *
     * @param source - The data to use for the original source data.
     *
     * @returns A new markdown cell. If a source cell is provided, the
     *   new cell will be initialized with the data from the source.
     */
    createMarkdownCell(options: CellModel.IOptions): IMarkdownCellModel {
      if (this.modelDB) {
        if (!options.id) {
          options.id = UUID.uuid4();
        }
        options.modelDB = this.modelDB.view(options.id);
      }
      return new DataflowMarkdownCellModel(options);
    }

    /**
     * Create a new raw cell.
     *
     * @param source - The data to use for the original source data.
     *
     * @returns A new raw cell. If a source cell is provided, the
     *   new cell will be initialized with the data from the source.
     */
    createRawCell(options: CellModel.IOptions): IRawCellModel {
      if (this.modelDB) {
        if (!options.id) {
          options.id = UUID.uuid4();
        }
        options.modelDB = this.modelDB.view(options.id);
      }
      return new DataflowRawCellModel(options);
    }

    /**
     * Clone the content factory with a new IModelDB.
     */
     clone(modelDB: IModelDB): ContentFactory {
      return new ContentFactory({
        modelDB: modelDB,
        codeCellContentFactory: this.codeCellContentFactory
      });
    }
  }

  /**
   * The default `ContentFactory` instance.
   */
  export const defaultContentFactory = new ContentFactory({});
}
