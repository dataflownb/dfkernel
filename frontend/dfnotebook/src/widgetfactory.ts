// Copyright (c) Jupyter Development Team.
// Distributed under the terms of the Modified BSD License.

import {
  ISessionContextDialogs,
  sessionContextDialogs
} from '@jupyterlab/apputils';
import { IEditorMimeTypeService } from '@jupyterlab/codeeditor';
import { ABCWidgetFactory, DocumentRegistry } from '@jupyterlab/docregistry';
import { IRenderMimeRegistry } from '@jupyterlab/rendermime';
import { ITranslator } from '@jupyterlab/translation';
import { ToolbarItems } from './default-toolbar';
import { INotebookModel } from './model';
import { NotebookPanel } from './panel';
import { StaticNotebook } from './widget';
import { NotebookPanel as JupyterNotebookPanel } from '@jupyterlab/notebook';

/**
 * A widget factory for notebook panels.
 */
export class NotebookWidgetFactory extends ABCWidgetFactory<
  NotebookPanel,
  INotebookModel
> {
  /**
   * Construct a new notebook widget factory.
   *
   * @param options - The options used to construct the factory.
   */
  constructor(options: NotebookWidgetFactory.IOptions<NotebookPanel>) {
    super(options);
    this.rendermime = options.rendermime;
    this.contentFactory =
      options.contentFactory || NotebookPanel.defaultContentFactory;
    this.mimeTypeService = options.mimeTypeService;
    this._editorConfig =
      options.editorConfig || StaticNotebook.defaultEditorConfig;
    this._notebookConfig =
      options.notebookConfig || StaticNotebook.defaultNotebookConfig;
    this._sessionDialogs = options.sessionDialogs || sessionContextDialogs;
    this.jupyterContentFactory = JupyterNotebookPanel.defaultContentFactory;
  }

  readonly jupyterContentFactory: JupyterNotebookPanel.IContentFactory;
  /*
   * The rendermime instance.
   */
  readonly rendermime: IRenderMimeRegistry;

  /**
   * The content factory used by the widget factory.
   */
  readonly contentFactory: NotebookPanel.IContentFactory;

  /**
   * The service used to look up mime types.
   */
  readonly mimeTypeService: IEditorMimeTypeService;

 //@ts-ignore
  public kernel: string;

  /**
   * A configuration object for cell editor settings.
   */
  get editorConfig(): StaticNotebook.IEditorConfig {
    return this._editorConfig;
  }
  set editorConfig(value: StaticNotebook.IEditorConfig) {
    this._editorConfig = value;
  }

  /**
   * A configuration object for notebook settings.
   */
  get notebookConfig(): StaticNotebook.INotebookConfig {
    return this._notebookConfig;
  }
  set notebookConfig(value: StaticNotebook.INotebookConfig) {
    this._notebookConfig = value;
  }

  /**
   * Create a new widget.
   *
   * #### Notes
   * The factory will start the appropriate kernel.
   */
  protected createNewWidget(
    context: DocumentRegistry.IContext<INotebookModel>,
    source?: NotebookPanel
  ): NotebookPanel {
    const nbOptions = {
      rendermime: source
        ? source.content.rendermime
        : this.rendermime.clone({ resolver: context.urlResolver }),
      contentFactory: this.contentFactory,
      mimeTypeService: this.mimeTypeService,
      editorConfig: source ? source.content.editorConfig : this._editorConfig,
      notebookConfig: source
        ? source.content.notebookConfig
        : this._notebookConfig,
      translator: this.translator
    };
    if(this.kernel != 'dfpython3'){
        const jupyterNbOptions = {
          rendermime: source
            ? source.content.rendermime
            : this.rendermime.clone({ resolver: context.urlResolver }),
          contentFactory: this.jupyterContentFactory,
          mimeTypeService: this.mimeTypeService,
          editorConfig: source ? source.content.editorConfig : this._editorConfig,
          notebookConfig: source
            ? source.content.notebookConfig
            : this._notebookConfig,
          translator: this.translator
        };
        console.log('Not DfPython exiting');
        const content = this.jupyterContentFactory.createNotebook(jupyterNbOptions);
        console.log(content);
        return new JupyterNotebookPanel({ context, content }) as unknown as NotebookPanel;
    }
    const content = this.contentFactory.createNotebook(nbOptions);
    return new NotebookPanel({ context, content });
  }

  /**
   * Default factory for toolbar items to be added after the widget is created.
   */
  protected defaultToolbarFactory(
    widget: NotebookPanel
  ): DocumentRegistry.IToolbarItem[] {
    return ToolbarItems.getDefaultItems(
      widget,
      this._sessionDialogs,
      this.translator
    );
  }

  private _editorConfig: StaticNotebook.IEditorConfig;
  private _notebookConfig: StaticNotebook.INotebookConfig;
  private _sessionDialogs: ISessionContextDialogs;
}

/**
 * The namespace for `NotebookWidgetFactory` statics.
 */
export namespace NotebookWidgetFactory {
  /**
   * The options used to construct a `NotebookWidgetFactory`.
   */
  export interface IOptions<T extends NotebookPanel>
    extends DocumentRegistry.IWidgetFactoryOptions<T> {
    /*
     * A rendermime instance.
     */
    rendermime: IRenderMimeRegistry;

    /**
     * A notebook panel content factory.
     */
    contentFactory: NotebookPanel.IContentFactory;

    /**
     * The service used to look up mime types.
     */
    mimeTypeService: IEditorMimeTypeService;

    /**
     * The notebook cell editor configuration.
     */
    editorConfig?: StaticNotebook.IEditorConfig;

    /**
     * The notebook configuration.
     */
    notebookConfig?: StaticNotebook.INotebookConfig;

    /**
     * The session context dialogs.
     */
    sessionDialogs?: ISessionContextDialogs;

    /**
     * The application language translator.
     */
    translator?: ITranslator;
  }

  /**
   * The interface for a notebook widget factory.
   */
  export interface IFactory
    extends DocumentRegistry.IWidgetFactory<NotebookPanel, INotebookModel> {
    /**
     * A configuration object for cell editor settings.
     */
    editorConfig: StaticNotebook.IEditorConfig;

    /**
     * A configuration object for notebook settings.
     */
    notebookConfig: StaticNotebook.INotebookConfig;

    /**
     * Whether the kernel should be shutdown when the widget is closed.
     */
    shutdownOnClose: boolean;
  }
}
