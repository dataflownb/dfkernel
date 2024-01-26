// Copyright (c) Jupyter Development Team.
// Distributed under the terms of the Modified BSD License.

// import { DocumentRegistry } from "@jupyterlab/docregistry";
import { NotebookWidgetFactory } from "@jupyterlab/notebook";

/**
 * A widget factory for notebook panels.
 */
export class DataflowNotebookWidgetFactory extends NotebookWidgetFactory {

  // What matters here is that the contentFactory gets set to use
  // DataflowNotebookPanel, so we don't need to override this
  
  // protected createNewWidget(
  //   context: DocumentRegistry.IContext<INotebookModel>,
  //   source?: NotebookPanel
  // ): NotebookPanel {
  //   const translator = (context as any).translator;
  //   const nbOptions = {
  //     rendermime: source
  //       ? source.content.rendermime
  //       : this.rendermime.clone({ resolver: context.urlResolver }),
  //     contentFactory: this.contentFactory,
  //     mimeTypeService: this.mimeTypeService,
  //     editorConfig: source ? source.content.editorConfig : this.editorConfig,
  //     notebookConfig: source
  //       ? source.content.notebookConfig
  //       : this.notebookConfig,
  //     translator
  //   };
  //   const content = this.contentFactory.createNotebook(nbOptions);

  //   return new NotebookPanel({ context, content });
  // }


}

export namespace DataflowNotebookWidgetFactory {
  export interface IFactory extends NotebookWidgetFactory.IFactory {

  }
}