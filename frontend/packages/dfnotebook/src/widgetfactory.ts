// Copyright (c) Jupyter Development Team.
// Distributed under the terms of the Modified BSD License.

import { NotebookWidgetFactory } from "@jupyterlab/notebook";

/**
 * A widget factory for notebook panels.
 */
export class DataflowNotebookWidgetFactory extends NotebookWidgetFactory {

}

export namespace DataflowNotebookWidgetFactory {
  export interface IFactory extends NotebookWidgetFactory.IFactory {

  }
}