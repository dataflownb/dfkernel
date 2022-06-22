// Copyright (c) Jupyter Development Team.
// Distributed under the terms of the Modified BSD License.

import { NotebookWidgetFactory } from "@jupyterlab/notebook";

// import { DocumentRegistry } from '@jupyterlab/docregistry';
// import { INotebookModel, NotebookPanel, NotebookWidgetFactory } from '@jupyterlab/notebook';
// import { DataflowNotebookPanel } from './panel';


/**
 * A widget factory for notebook panels.
 */
export class DataflowNotebookWidgetFactory extends NotebookWidgetFactory {
  // pointless because user must supply contentFactory as argument to constructor, I think
  // get an error without this
  //
  // /**
  //  * Construct a new notebook widget factory.
  //  *
  //  * @param options - The options used to construct the factory.
  //  */
  // constructor(options: NotebookWidgetFactory.IOptions<NotebookPanel>) {
  //   super({contentFactory: DataflowNotebookPanel.defaultContentFactory, ...options});
  // }

  // FIXME: see if we should re-enable this based on kerneL?
  /**
   * Create a new widget.
   *
   * #### Notes
   * The factory will start the appropriate kernel.
   */
  // protected createNewWidget(
  //   context: DocumentRegistry.IContext<INotebookModel>,
  //   source?: NotebookPanel
  // ): NotebookPanel {
  //   if (this.kernel == 'dfpython3') {
  //     const content = this.

  //   }
  //   const nbOptions = {
  //     rendermime: source
  //       ? source.content.rendermime
  //       : this.rendermime.clone({ resolver: context.urlResolver }),
  //     contentFactory: this.contentFactory,
  //     mimeTypeService: this.mimeTypeService,
  //     editorConfig: source ? source.content.editorConfig : this._editorConfig,
  //     notebookConfig: source
  //       ? source.content.notebookConfig
  //       : this._notebookConfig,
  //     translator: this.translator
  //   };
  //   if(this.kernel != 'dfpython3'){
  //       const jupyterNbOptions = {
  //         rendermime: source
  //           ? source.content.rendermime
  //           : this.rendermime.clone({ resolver: context.urlResolver }),
  //         contentFactory: this.jupyterContentFactory,
  //         mimeTypeService: this.mimeTypeService,
  //         editorConfig: source ? source.content.editorConfig : this._editorConfig,
  //         notebookConfig: source
  //           ? source.content.notebookConfig
  //           : this._notebookConfig,
  //         translator: this.translator
  //       };
  //       console.log('Not DfPython exiting');
  //       const content = this.jupyterContentFactory.createNotebook(jupyterNbOptions);
  //       console.log(content);
  //       return new JupyterNotebookPanel({ context, content }) as unknown as NotebookPanel;
  //   }
  //   const content = this.contentFactory.createNotebook(nbOptions);
  //   return new NotebookPanel({ context, content });
  // }
}