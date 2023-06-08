// Copyright (c) Jupyter Development Team.
// Distributed under the terms of the Modified BSD License.
/**
 * @packageDocumentation
 * @module dfnotebook-extension
 */

import {
  ILayoutRestorer,
  ILabShell,
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application';
import {
  createToolbarFactory,
  Dialog,
  ICommandPalette,
  InputDialog,
  ISessionContextDialogs,
  IToolbarWidgetRegistry,
  MainAreaWidget,
  sessionContextDialogs,
  showDialog,
  // Toolbar,
  ToolbarButton
} from '@jupyterlab/apputils';
import { Graph, Manager as GraphManager, ViewerWidget } from '@dfnotebook/dfgraph';
import { CellBarExtension } from '@jupyterlab/cell-toolbar';
import { Cell, CodeCell, ICellModel, MarkdownCell } from '@jupyterlab/cells';
import { IEditorServices } from '@jupyterlab/codeeditor';
import { IDocumentWidget } from '@jupyterlab/docregistry';
import { IFileBrowserFactory } from '@jupyterlab/filebrowser';
import { ILauncher } from '@jupyterlab/launcher';
import {
  IEditMenu,
  IFileMenu,
  IHelpMenu,
  IKernelMenu,
  IMainMenu,
  IRunMenu,
  IViewMenu
} from '@jupyterlab/mainmenu';
import * as nbformat from '@jupyterlab/nbformat';
import {
  INotebookTracker,
  INotebookWidgetFactory,
  Notebook,
  NotebookPanel,
  NotebookTracker,
  NotebookWidgetFactory,
  StaticNotebook,
  NotebookActions,
  NotebookModelFactory,
} from '@jupyterlab/notebook';
import {
  IObservableList,
  IObservableUndoableList
} from '@jupyterlab/observables';
import { ISettingRegistry } from '@jupyterlab/settingregistry';
import { ITranslator, nullTranslator } from '@jupyterlab/translation';
import {
  addAboveIcon,
  addBelowIcon,
  copyIcon,
  cutIcon,
  duplicateIcon,
  moveDownIcon,
  moveUpIcon,
  notebookIcon,
  pasteIcon
} from '@jupyterlab/ui-components';
import { ArrayExt } from '@lumino/algorithm';
import { CommandRegistry } from '@lumino/commands';
import {
  JSONExt,
  JSONObject,
  ReadonlyJSONValue,
  ReadonlyPartialJSONObject,
  UUID
} from '@lumino/coreutils';
import { DisposableSet } from '@lumino/disposable';
import { Panel} from '@lumino/widgets';

import {
  DataflowNotebookModelFactory,
  DataflowNotebookWidgetFactory,
  DataflowNotebookPanel,
  DataflowNotebookActions,
  IDataflowNotebookModelFactory,  
  IDataflowNotebookContentFactory,
  IDataflowNotebookWidgetFactory,
  DataflowNotebookModel,
  DataflowNotebook
} from '@dfnotebook/dfnotebook';
import { IRenderMimeRegistry } from '@jupyterlab/rendermime';
import { PageConfig } from '@jupyterlab/coreutils';
import { DataflowInputArea } from '@dfnotebook/dfcells';

/**
 * The command IDs used by the notebook plugin.
 */
namespace CommandIDs {
  export const createNew = 'notebook:create-new';

  export const interrupt = 'notebook:interrupt-kernel';

  export const restart = 'notebook:restart-kernel';

  export const restartClear = 'notebook:restart-clear-output';

  export const restartAndRunToSelected = 'notebook:restart-and-run-to-selected';

  export const restartRunAll = 'notebook:restart-run-all';

  export const reconnectToKernel = 'notebook:reconnect-to-kernel';

  export const changeKernel = 'notebook:change-kernel';

  export const createConsole = 'notebook:create-console';

  export const createOutputView = 'notebook:create-output-view';

  export const clearAllOutputs = 'notebook:clear-all-cell-outputs';

  export const closeAndShutdown = 'notebook:close-and-shutdown';

  export const trust = 'notebook:trust';

  export const exportToFormat = 'notebook:export-to-format';

  export const run = 'notebook:run-cell';

  export const runAndAdvance = 'notebook:run-cell-and-select-next';

  export const runAndInsert = 'notebook:run-cell-and-insert-below';

  export const runInConsole = 'notebook:run-in-console';

  export const runAll = 'notebook:run-all-cells';

  export const runAllAbove = 'notebook:run-all-above';

  export const runAllBelow = 'notebook:run-all-below';

  export const renderAllMarkdown = 'notebook:render-all-markdown';

  export const toCode = 'notebook:change-cell-to-code';

  export const toMarkdown = 'notebook:change-cell-to-markdown';

  export const toRaw = 'notebook:change-cell-to-raw';

  export const cut = 'notebook:cut-cell';

  export const copy = 'notebook:copy-cell';

  export const pasteAbove = 'notebook:paste-cell-above';

  export const pasteBelow = 'notebook:paste-cell-below';

  export const duplicateBelow = 'notebook:duplicate-below';

  export const pasteAndReplace = 'notebook:paste-and-replace-cell';

  export const moveUp = 'notebook:move-cell-up';

  export const moveDown = 'notebook:move-cell-down';

  export const clearOutputs = 'notebook:clear-cell-output';

  export const deleteCell = 'notebook:delete-cell';

  export const insertAbove = 'notebook:insert-cell-above';

  export const insertBelow = 'notebook:insert-cell-below';

  export const selectAbove = 'notebook:move-cursor-up';

  export const selectBelow = 'notebook:move-cursor-down';

  export const extendAbove = 'notebook:extend-marked-cells-above';

  export const extendTop = 'notebook:extend-marked-cells-top';

  export const extendBelow = 'notebook:extend-marked-cells-below';

  export const extendBottom = 'notebook:extend-marked-cells-bottom';

  export const selectAll = 'notebook:select-all';

  export const deselectAll = 'notebook:deselect-all';

  export const editMode = 'notebook:enter-edit-mode';

  export const merge = 'notebook:merge-cells';

  export const mergeAbove = 'notebook:merge-cell-above';

  export const mergeBelow = 'notebook:merge-cell-below';

  export const split = 'notebook:split-cell-at-cursor';

  export const commandMode = 'notebook:enter-command-mode';

  export const toggleAllLines = 'notebook:toggle-all-cell-line-numbers';

  export const undoCellAction = 'notebook:undo-cell-action';

  export const redoCellAction = 'notebook:redo-cell-action';

  export const markdown1 = 'notebook:change-cell-to-heading-1';

  export const markdown2 = 'notebook:change-cell-to-heading-2';

  export const markdown3 = 'notebook:change-cell-to-heading-3';

  export const markdown4 = 'notebook:change-cell-to-heading-4';

  export const markdown5 = 'notebook:change-cell-to-heading-5';

  export const markdown6 = 'notebook:change-cell-to-heading-6';

  export const hideCode = 'notebook:hide-cell-code';

  export const showCode = 'notebook:show-cell-code';

  export const hideAllCode = 'notebook:hide-all-cell-code';

  export const showAllCode = 'notebook:show-all-cell-code';

  export const hideOutput = 'notebook:hide-cell-outputs';

  export const showOutput = 'notebook:show-cell-outputs';

  export const hideAllOutputs = 'notebook:hide-all-cell-outputs';

  export const showAllOutputs = 'notebook:show-all-cell-outputs';

  export const toggleRenderSideBySideCurrentNotebook =
    'notebook:toggle-render-side-by-side-current';

  export const setSideBySideRatio = 'notebook:set-side-by-side-ratio';

  export const enableOutputScrolling = 'notebook:enable-output-scrolling';

  export const disableOutputScrolling = 'notebook:disable-output-scrolling';

  export const selectLastRunCell = 'notebook:select-last-run-cell';

  export const replaceSelection = 'notebook:replace-selection';

  export const autoClosingBrackets = 'notebook:toggle-autoclosing-brackets';

  export const toggleCollapseCmd = 'Collapsible_Headings:Toggle_Collapse';

  export const collapseAllCmd = 'Collapsible_Headings:Collapse_All';

  export const expandAllCmd = 'Collapsible_Headings:Expand_All';

  export const copyToClipboard = 'notebook:copy-to-clipboard';

  export const tagCell = 'notebook:tag-cell';
}

/**
 * The name of the factory that creates notebooks.
 */
const FACTORY = 'Notebook';

/**
 * The name of the factory that creates dataflow notebooks.
 */
const DATAFLOW_FACTORY = 'Dataflow Notebook';

// /**
//  * Setting Id storing the customized toolbar definition.
//  */
// const PANEL_SETTINGS = '@jupyterlab/notebook-extension:panel';

/**
 * The id to use on the style tag for the side by side margins.
 */
const SIDE_BY_SIDE_STYLE_ID = 'jp-NotebookExtension-sideBySideMargins';

/**
 * The notebook widget tracker provider.
 */
const trackerPlugin: JupyterFrontEndPlugin<INotebookTracker> = {
  id: '@dfnotebook/dfnotebook-extension:tracker',
  provides: INotebookTracker,
  requires: [
    INotebookWidgetFactory,
    IDataflowNotebookWidgetFactory,
    IDataflowNotebookModelFactory,
    ITranslator
  ],
  optional: [
    ICommandPalette,
    IFileBrowserFactory,
    ILauncher,
    ILayoutRestorer,
    IMainMenu,
    ISettingRegistry,
    ISessionContextDialogs,
  ],
  activate: activateNotebookHandler,
  autoStart: true
};

/**
 * The dataflow notebook cell factory provider.
 */
const contentFactoryPlugin: JupyterFrontEndPlugin<DataflowNotebookPanel.IContentFactory> = {
  id: '@dfnotebook/dfnotebook-extension:factory',
  provides: IDataflowNotebookContentFactory,
  requires: [IEditorServices],
  autoStart: true,
  activate: (app: JupyterFrontEnd, editorServices: IEditorServices) => {
    const editorFactory = editorServices.factoryService.newInlineEditor;
    return new DataflowNotebookPanel.ContentFactory({ editorFactory });
  }
};

/**
 * The dataflow notebook widget factory provider.
 */
const widgetFactoryPlugin: JupyterFrontEndPlugin<DataflowNotebookWidgetFactory.IFactory> = {
  id: '@dfnotebook/dfnotebook-extension:widget-factory',
  provides: IDataflowNotebookWidgetFactory,
  requires: [
    IDataflowNotebookContentFactory,
    IEditorServices,
    IRenderMimeRegistry,
    ISessionContextDialogs,
    IToolbarWidgetRegistry,
    ITranslator
  ],
  optional: [ISettingRegistry],
  activate: activateDataflowWidgetFactory,
  autoStart: true
};

/**
 * The dataflow notebook model factory provider.
 */
const modelFactoryPlugin: JupyterFrontEndPlugin<DataflowNotebookModelFactory.IFactory> = {
  id: '@dfnotebook/dfnotebook-extension:model-factory',
  provides: IDataflowNotebookModelFactory,
  requires: [
    IDataflowNotebookWidgetFactory
  ],
  optional: [ISettingRegistry],
  activate: activateDataflowModelFactory,
  autoStart: true,
}
/**
 * Initialization for the Dfnb GraphManager for working with multiple graphs.
 */
const GraphManagerPlugin: JupyterFrontEndPlugin<void> = {
  id: 'dfnb-graph',
  autoStart: true,
  requires: [ICommandPalette,INotebookTracker],
  activate: (app: JupyterFrontEnd, palette: ICommandPalette,nbTrackers:INotebookTracker) => {
   // Create a blank content widget inside of a MainAreaWidget
      console.log("GraphManager is active");
      let shell = app.shell as ILabShell;

      nbTrackers.widgetAdded.connect((sender,nbPanel) => {
            const session = nbPanel.sessionContext;
            GraphManager.set_tracker(nbTrackers);

            session.ready.then(() =>
            {
                let output_tags: {[index: string]:any}  = {};
                let cell_contents: {[index: string]:any} = {};
                let cell_list = (nbPanel.model?.toJSON() as any)?.cells;

                cell_list.map(function(cell:any)
                {
                let cell_id = cell.id.replace(/-/g, '').substr(0, 8) as string;
                if(cell?.cell_type != "code"){return;}
                cell_contents[cell_id] = cell.source;
                output_tags[cell_id] =
                (cell?.outputs).map(
                    (output:any)=>output.metadata.output_tag)
                });
                let cells = Object.keys(output_tags);
                let uplinks : {[index: string]:any} = cells.reduce((dict:{[index: string]:any},cell_id:string)=>{dict[cell_id]={};return dict;},{});
                let downlinks : {[index: string]:any} = cells.reduce((dict:{[index: string]:any},cell_id:string)=>{dict[cell_id]=[];return dict;},{});;
                Object.keys(cell_contents).map(function(cell_id){
                    let regex = /\w+\$[a-f0-9]{8}/g
                    let references = (cell_contents[cell_id].match(regex)) || [];
                    references.map(function(reference:string){
                       let ref = reference.split('$');
                       if (ref[1] in uplinks[cell_id]){
                         uplinks[cell_id][ref[1]].push(ref[0]);
                       }
                       else{
                         uplinks[cell_id][ref[1]] = [ref[0]]
                       }
                       downlinks[ref[1]].push(cell_id);
                    });
                })
                let sess_id = session?.session?.id || "None";
                if(!(sess_id in Object.keys(GraphManager.graphs))){
                    //GraphManager.graphs[sess_id] = new Graph({});
                    //@ts-ignore
                    GraphManager.graphs[sess_id] = new Graph({'cells':cells,'nodes':output_tags,'internal_nodes':output_tags,'uplinks':uplinks,'downlinks':downlinks,'cell_contents':cell_contents});
                    GraphManager.update_graph(sess_id);
                    let cell_order = cell_list.map((c:any) => c.id);
                    GraphManager.update_order(cell_order);
                }
                console.log(sess_id);
            });
            (nbPanel.content as any).model._cells._cellOrder._changed.connect(() =>{
                //console.log((nbPanel.content as any)._model._cells._cellOrder._array);
                GraphManager.update_order((nbPanel.content as any).model._cells._cellOrder._array);
            });
            nbPanel.content.activeCellChanged.connect(() =>{
                let prevActive = GraphManager.get_active();
                if(prevActive != "None"){
                    let uuid = prevActive.id.replace(/-/g, '').substr(0, 8);
                    if(prevActive.value.text != GraphManager.get_text(uuid)){
                        GraphManager.mark_stale(uuid);
                    }
                    else if(GraphManager.get_stale(uuid) == 'Stale'){
                        GraphManager.revert_stale(uuid);
                    }
                }
                //Have to get this off the model the same way that actions.tsx does
                let activeId = nbPanel.content.activeCell?.model?.id.replace(/-/g, '').substr(0, 8);
                //console.log("Active Cell ID: ",activeId,nbPanel.content.activeCell?.model?.value.text);
                GraphManager.update_active(activeId,nbPanel.content.activeCell?.model);
            });
      });


      shell.currentChanged.connect((_, change) => {
      //@ts-ignore
        let sess_id = change['newValue']?.sessionContext?.session?.id;
        //@ts-ignore
        console.log(change['newValue']?.sessionContext?.session?.id);
        //console.log(GraphManager.depview.is_open);
        console.log(GraphManager.graphs);
        if(sess_id in GraphManager.graphs){
            GraphManager.update_graph(sess_id);
            console.log(GraphManager.graphs[GraphManager.current_graph]);
        }
        //if(GraphManager.depview.is_open){
        //    console.log("Updating dependency view");
            //console.log(change['newValue']);

        //    if(!(change['newValue']?.node?.id == 'dfnb-depview')){
                //@ts-ignore
        //        console.log(change['newValue']?.sessionContext?.session?.id);
        //    }
         //   console.log(change['newValue']?.node?.id);
        //}
        // ...
        });

  }

}


/**
 * Initialization data for the Dfnb Depviewer extension.
 */
const DepViewer: JupyterFrontEndPlugin<void> = {
  id: 'dfnb-depview',
  autoStart: true,
  requires: [ICommandPalette, INotebookTracker],
  activate: (app: JupyterFrontEnd, palette: ICommandPalette, nbTrackers: INotebookTracker) => {

  // Create a blank content widget inside of a MainAreaWidget
      const content = new ViewerWidget();
      //GraphManager uses flags from the ViewerWidget
      GraphManager.depWidget = content;
      const widget = new MainAreaWidget({ content });
      widget.id = 'dfnb-depview';
      widget.title.label = 'Dependency Viewer';
      widget.title.closable = true;
      // Add a div to the panel
        let panel = document.createElement('div');
        panel.setAttribute('id','depview');
        content.node.appendChild(panel);
          function openDepViewer(){
              if (!widget.isAttached) {
                // Attach the widget to the main work area if it's not there
                app.shell.add(widget, 'main',{
                    mode: 'split-right',
                    activate: false
                });
                if (!GraphManager.depview.is_created){
                  GraphManager.depview.create_dep_div();
                }


              }
              // Activate the widget
              app.shell.activateById(widget.id);
              GraphManager.depview.is_open = true;
              GraphManager.depview.startGraphCreation();
            }

          nbTrackers.widgetAdded.connect((sender,nbPanel) => {
            const session = nbPanel.sessionContext;
              session.ready.then(() => {
                if(session.session?.kernel?.name == 'dfpython3'){

                    const button = new ToolbarButton({
                        className: 'open-dep-view',
                        label: 'Open Dependency Viewer',
                        onClick: openDepViewer,
                        tooltip: 'Opens the Dependency Viewer',
                    });
                    nbPanel.toolbar.insertItem(10, 'Open Dependency Viewer', button);
                }
              });
           });

          // Add an application command
          const command: string = 'depview:open';
          app.commands.addCommand(command, {
            label: 'Open Dependency Viewer',
            execute: () => openDepViewer,
          });

          // Add the command to the palette.
          palette.addItem({ command, category: 'Tutorial' });
        }
    };


/**
 * Initialization data for the Minimap extension.
 */
const MiniMap: JupyterFrontEndPlugin<void> = {
  id: 'dfnb-minimap',
  autoStart: true,
  requires: [ICommandPalette, INotebookTracker],
  activate: (app: JupyterFrontEnd, palette: ICommandPalette, nbTrackers: INotebookTracker) => {


      const content = new ViewerWidget();
      //Graph Manager maintains the flags on the widgets
      GraphManager.miniWidget = content;
      const widget = new MainAreaWidget({ content });
      widget.id = 'dfnb-minimap';
      widget.title.label = 'Notebook Minimap';
      widget.title.closable = true;
      // Add a div to the panel
        let panel = document.createElement('div');
        panel.setAttribute('id','minimap');
        let inner = document.createElement('div');
        inner.setAttribute('id','minidiv');
        let svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        svg.setAttributeNS("http://www.w3.org/2000/xmlns/", "xmlns:xlink", "http://www.w3.org/1999/xlink");
        svg.setAttribute('id','minisvg');
        inner.append(svg);
        panel.appendChild(inner);
        content.node.appendChild(panel);


        nbTrackers.widgetAdded.connect((sender,nbPanel) => {
            const session = nbPanel.sessionContext;
              session.ready.then(() => {
                if(session.session?.kernel?.name == 'dfpython3'){

                    const button = new ToolbarButton({
                        className: 'open-mini-map',
                        label: 'Open Minimap',
                        onClick: openMinimap,
                        tooltip: 'Opens the Minimap',
                    });
                    nbPanel.toolbar.insertItem(10, 'Open Minimap', button);
                }
              });
           });

          function openMinimap(){
          console.log("Attaching right?");
              if (!widget.isAttached) {
              console.log("Attached right");
              console.log(content.is_open);
                // Attach the widget to the right side work area if it's not there
                //app.shell.add(widget, 'main');
                app.shell.add(widget, 'main'
                ,{
                    mode: 'split-right',
                    activate: false
                });
                //'right');

                if(!GraphManager.minimap.was_created){
                    console.log("Active Graph",GraphManager.graphs[GraphManager.current_graph])

                    // Activate the widget
                    app.shell.activateById(widget.id);
                    GraphManager.minimap.createMiniArea(svg);
                    GraphManager.minimap.was_created = true;
                }
                else{
                    GraphManager.minimap.startMinimapCreation();
                }

              }
            }

          // Add an application command
          const command: string = 'minimap:open';
          app.commands.addCommand(command, {
            label: 'Open Minimap',
            execute: () => openMinimap,
          });

          // Add the command to the palette.
          palette.addItem({ command, category: 'Tutorial' });
        }
    };


const cellToolbar: JupyterFrontEndPlugin<void> = {
  id: '@dfnotebook/dfnotebook-extension:cell-toolbar',
  autoStart: true,
  activate: async (
    app: JupyterFrontEnd,
    settingRegistry: ISettingRegistry | null,
    toolbarRegistry: IToolbarWidgetRegistry | null,
    translator: ITranslator | null
  ) => {
    const cellToolbarId = '@jupyterlab/cell-toolbar-extension:plugin';
    const toolbarItems =
      settingRegistry && toolbarRegistry
        ? createToolbarFactory(
            toolbarRegistry,
            settingRegistry,
            CellBarExtension.FACTORY_NAME,
            cellToolbarId,
            translator ?? nullTranslator
          )
        : undefined;

    app.docRegistry.addWidgetExtension(
      DATAFLOW_FACTORY,
      new CellBarExtension(app.commands, toolbarItems)
    );
  },
  optional: [ISettingRegistry, IToolbarWidgetRegistry, ITranslator]
};

const plugins: JupyterFrontEndPlugin<any>[] = [
  contentFactoryPlugin,
  widgetFactoryPlugin,
  modelFactoryPlugin,
  trackerPlugin,
  cellToolbar,
  DepViewer,
  MiniMap,
  GraphManagerPlugin
]
export default plugins;

function activateDataflowModelFactory(
  app: JupyterFrontEnd,
  widgetFactory: DataflowNotebookWidgetFactory.IFactory,
  settingRegistry: ISettingRegistry | null
): DataflowNotebookModelFactory.IFactory {
  const registry = app.docRegistry;
  // FIXME need to connect settings changes to this modelFactory?
  const modelFactory = new DataflowNotebookModelFactory({
    disableDocumentWideUndoRedo:
      widgetFactory.notebookConfig.disableDocumentWideUndoRedo
  });
  registry.addModelFactory(modelFactory);
  return modelFactory;
}

/**
 * Activate the notebook widget factory.
 */
function activateDataflowWidgetFactory(
  app: JupyterFrontEnd,
  contentFactory: DataflowNotebookPanel.IContentFactory,
  editorServices: IEditorServices,
  rendermime: IRenderMimeRegistry,
  sessionContextDialogs: ISessionContextDialogs,
  toolbarRegistry: IToolbarWidgetRegistry,
  translator: ITranslator,
  settingRegistry: ISettingRegistry | null
): NotebookWidgetFactory.IFactory {
  const preferKernelOption = PageConfig.getOption('notebookStartsKernel');

  // If the option is not set, assume `true`
  const preferKernelValue =
    preferKernelOption === '' || preferKernelOption.toLowerCase() === 'true';

  // const { commands } = app;
  // let toolbarFactory:
  //   | ((
  //       widget: NotebookPanel
  //     ) =>
  //       | DocumentRegistry.IToolbarItem[]
  //       | IObservableList<DocumentRegistry.IToolbarItem>)
  //   | undefined;

  // // Register notebook toolbar widgets
  // toolbarRegistry.registerFactory<NotebookPanel>(DATAFLOW_FACTORY, 'save', panel =>
  //   DocToolbarItems.createSaveButton(commands, panel.context.fileChanged)
  // );
  // toolbarRegistry.registerFactory<NotebookPanel>(DATAFLOW_FACTORY, 'cellType', panel => {
  //   return ToolbarItems.createCellTypeItem(panel, translator);
  //   }
  // );
  // toolbarRegistry.registerFactory<NotebookPanel>(DATAFLOW_FACTORY, 'kernelName', panel =>
  //   Toolbar.createKernelNameItem(
  //     panel.sessionContext,
  //     sessionContextDialogs,
  //     translator
  //   )
  // );

  // toolbarRegistry.registerFactory<NotebookPanel>(
  //   DATAFLOW_FACTORY,
  //   'executionProgress',
  //   panel => {
  //     return ExecutionIndicator.createExecutionIndicatorItem(
  //       panel,
  //       translator,
  //       settingRegistry?.load(trackerPlugin.id)
  //     );
  //   }
  // );

  // if (settingRegistry) {
  //   // Create the factory
  //   toolbarFactory = createToolbarFactory(
  //     toolbarRegistry,
  //     settingRegistry,
  //     DATAFLOW_FACTORY,
  //     PANEL_SETTINGS,
  //     translator
  //   );
  // }

  const factory = new NotebookWidgetFactory({
    name: DATAFLOW_FACTORY,
    fileTypes: ['notebook'],
    modelName: 'dfnotebook',
    defaultFor: ['notebook'],
    preferKernel: preferKernelValue,
    canStartKernel: true,
    rendermime,
    contentFactory,
    editorConfig: StaticNotebook.defaultEditorConfig,
    notebookConfig: StaticNotebook.defaultNotebookConfig,
    mimeTypeService: editorServices.mimeTypeService,
    sessionDialogs: sessionContextDialogs,
    // toolbarFactory,
    translator: translator
  });
  app.docRegistry.addWidgetFactory(factory);

  return factory;
}

// FIXME if we set the model factory on the docRegistry first
// we can prevent the setting in activateNotebookHandler
// also need a way to modify the app commands for run...
// then may be able to get rid of all this code...
/**
 * Activate the notebook handler extension.
 */
function activateNotebookHandler(
  app: JupyterFrontEnd,
  factory: NotebookWidgetFactory.IFactory,
  dfFactory: DataflowNotebookWidgetFactory.IFactory,
  dfModelFactory: DataflowNotebookModelFactory.IFactory,
  translator: ITranslator,
  palette: ICommandPalette | null,
  browserFactory: IFileBrowserFactory | null,
  launcher: ILauncher | null,
  restorer: ILayoutRestorer | null,
  mainMenu: IMainMenu | null,
  settingRegistry: ISettingRegistry | null,
  sessionDialogs: ISessionContextDialogs | null
): INotebookTracker {
  const trans = translator.load('jupyterlab');
  const services = app.serviceManager;

  const { commands } = app;
  const tracker = new NotebookTracker({ namespace: 'notebook' });

  // Fetch settings if possible.
  const jlabTrackerId = '@jupyterlab/notebook-extension:tracker';
  const fetchSettings = settingRegistry
    ? settingRegistry.load(jlabTrackerId)
    : Promise.reject(new Error(`No setting registry for ${jlabTrackerId}`));

  fetchSettings
    .then(settings => {
      updateConfig(factory, settings);
      updateConfig(dfFactory, settings);
      settings.changed.connect(() => {
        updateConfig(factory, settings);
        updateConfig(dfFactory, settings);
      });
      commands.addCommand(CommandIDs.autoClosingBrackets, {
        execute: args => {
          const codeConfig = settings.get('codeCellConfig')
            .composite as JSONObject;
          const markdownConfig = settings.get('markdownCellConfig')
            .composite as JSONObject;
          const rawConfig = settings.get('rawCellConfig')
            .composite as JSONObject;
          const anyToggled =
            codeConfig.autoClosingBrackets ||
            markdownConfig.autoClosingBrackets ||
            rawConfig.autoClosingBrackets;
          const toggled = !!(args['force'] ?? !anyToggled);
          [
            codeConfig.autoClosingBrackets,
            markdownConfig.autoClosingBrackets,
            rawConfig.autoClosingBrackets
          ] = [toggled, toggled, toggled];

          void settings.set('codeCellConfig', codeConfig);
          void settings.set('markdownCellConfig', markdownConfig);
          void settings.set('rawCellConfig', rawConfig);
        },
        label: trans.__('Auto Close Brackets for All Notebook Cell Types'),
        isToggled: () =>
          ['codeCellConfig', 'markdownCellConfig', 'rawCellConfig'].some(
            x => (settings.get(x).composite as JSONObject).autoClosingBrackets
          )
      });
    })
    .catch((reason: Error) => {
      console.warn(reason.message);
      updateTracker({
        editorConfig: factory.editorConfig,
        notebookConfig: factory.notebookConfig,
        kernelShutdown: factory.shutdownOnClose
      });
    });
  // Handle state restoration.
  if (restorer) {
    //FIXME: This needs to get the kernel information from somewhere
    //(factory as NotebookWidgetFactory).kernel = "dfpython3";
    void restorer.restore(tracker, {
      command: 'docmanager:open',
      args: panel => ({ 
        path: panel.context.path, 
        factory: (panel.context.model instanceof DataflowNotebookModel) ? DATAFLOW_FACTORY : FACTORY 
      }),
      // use notebook or dfnotebook prefix on name here...
      name: panel => panel.context.path,
      when: services.ready
    });
  }

  const registry = app.docRegistry;
  const modelFactory = new NotebookModelFactory({
    disableDocumentWideUndoRedo:
      factory.notebookConfig.disableDocumentWideUndoRedo,
    collaborative: true
  });
  registry.addModelFactory(modelFactory);
  
  addCommands(app, tracker, translator, sessionDialogs);

  if (palette) {
    populatePalette(palette, translator);
  }

  let id = 0; // The ID counter for notebook panels.

  const ft = app.docRegistry.getFileType('notebook');

  function connectWidgetCreated(factory: NotebookWidgetFactory.IFactory) {
    factory.widgetCreated.connect((sender, widget) => {
      // If the notebook panel does not have an ID, assign it one.
      widget.id = widget.id || `notebook-${++id}`;

      // Set up the title icon
      widget.title.icon = ft?.icon;
      widget.title.iconClass = ft?.iconClass ?? '';
      widget.title.iconLabel = ft?.iconLabel ?? '';

      // Notify the widget tracker if restore data needs to update.
      widget.context.pathChanged.connect(() => {
        void tracker.save(widget);
      });
      // Add the notebook panel to the tracker.
      void tracker.add(widget);
    });
  }
  connectWidgetCreated(factory);
  connectWidgetCreated(dfFactory);

  /**
   * Update the settings of the current tracker.
   */
  function updateTracker(options: NotebookPanel.IConfig): void {
    tracker.forEach(widget => {
      widget.setConfig(options);
    });
  }

  /**
   * Update the setting values.
   */
  function updateConfig(factory: NotebookWidgetFactory.IFactory, settings: ISettingRegistry.ISettings): void {
    const code = {
      ...StaticNotebook.defaultEditorConfig.code,
      ...(settings.get('codeCellConfig').composite as JSONObject)
    };

    const markdown = {
      ...StaticNotebook.defaultEditorConfig.markdown,
      ...(settings.get('markdownCellConfig').composite as JSONObject)
    };

    const raw = {
      ...StaticNotebook.defaultEditorConfig.raw,
      ...(settings.get('rawCellConfig').composite as JSONObject)
    };

    factory.editorConfig = { code, markdown, raw };
    factory.notebookConfig = {
      scrollPastEnd: settings.get('scrollPastEnd').composite as boolean,
      defaultCell: settings.get('defaultCell').composite as nbformat.CellType,
      recordTiming: settings.get('recordTiming').composite as boolean,
      numberCellsToRenderDirectly: settings.get('numberCellsToRenderDirectly')
        .composite as number,
      remainingTimeBeforeRescheduling: settings.get(
        'remainingTimeBeforeRescheduling'
      ).composite as number,
      renderCellOnIdle: settings.get('renderCellOnIdle').composite as boolean,
      observedTopMargin: settings.get('observedTopMargin').composite as string,
      observedBottomMargin: settings.get('observedBottomMargin')
        .composite as string,
      maxNumberOutputs: settings.get('maxNumberOutputs').composite as number,
      showEditorForReadOnlyMarkdown: settings.get(
        'showEditorForReadOnlyMarkdown'
      ).composite as boolean,
      disableDocumentWideUndoRedo: !settings.get(
        'experimentalDisableDocumentWideUndoRedo'
      ).composite as boolean,
      renderingLayout: settings.get('renderingLayout').composite as
        | 'default'
        | 'side-by-side',
      sideBySideLeftMarginOverride: settings.get('sideBySideLeftMarginOverride')
        .composite as string,
      sideBySideRightMarginOverride: settings.get(
        'sideBySideRightMarginOverride'
      ).composite as string,
      sideBySideOutputRatio: settings.get(
        'sideBySideOutputRatio'
      ).composite as number
    };
    const sideBySideMarginStyle = `.jp-mod-sideBySide.jp-Notebook .jp-Notebook-cell { 
      margin-left: ${factory.notebookConfig.sideBySideLeftMarginOverride} !important;
      margin-right: ${factory.notebookConfig.sideBySideRightMarginOverride} !important;`;
    const sideBySideMarginTag = document.getElementById(SIDE_BY_SIDE_STYLE_ID);
    if (sideBySideMarginTag) {
      sideBySideMarginTag.innerText = sideBySideMarginStyle;
    } else {
      document.head.insertAdjacentHTML(
        'beforeend',
        `<style id="${SIDE_BY_SIDE_STYLE_ID}">${sideBySideMarginStyle}}</style>`
      );
    }
    factory.shutdownOnClose = settings.get('kernelShutdown')
      .composite as boolean;

    modelFactory.disableDocumentWideUndoRedo = settings.get(
      'experimentalDisableDocumentWideUndoRedo'
    ).composite as boolean;

    updateTracker({
      editorConfig: factory.editorConfig,
      notebookConfig: factory.notebookConfig,
      kernelShutdown: factory.shutdownOnClose
    });
  }

  // Add main menu notebook menu.
  if (mainMenu) {
    populateMenus(app, mainMenu, tracker, translator, sessionDialogs);
  }

  // Utility function to create a new notebook.
  const createNew = async (cwd: string, kernelName?: string) => {
    const model = await commands.execute('docmanager:new-untitled', {
      path: cwd,
      type: 'notebook'
    });
    if (model != undefined) {
      const widget = ((await commands.execute('docmanager:open', {
        path: model.path,
        factory: kernelName == "dfpython3" ? DATAFLOW_FACTORY : FACTORY,
        kernel: { name: kernelName }
      })) as unknown) as IDocumentWidget;
      widget.isUntitled = true;
      return widget;
    }
  };
    

  // Add a command for creating a new notebook.
  commands.addCommand(CommandIDs.createNew, {
    label: args => {
      const kernelName = (args['kernelName'] as string) || '';
      if (args['isLauncher'] && args['kernelName'] && services.kernelspecs) {
        return (
          services.kernelspecs.specs?.kernelspecs[kernelName]?.display_name ??
          ''
        );
      }
      if (args['isPalette'] || args['isContextMenu']) {
        return trans.__('New Notebook');
      }
      return trans.__('Notebook');
    },
    caption: trans.__('Create a new notebook'),
    icon: args => (args['isPalette'] ? undefined : notebookIcon),
    execute: args => {
      const cwd =
        (args['cwd'] as string) ||
        (browserFactory ? browserFactory.defaultBrowser.model.path : '');
      const kernelName = (args['kernelName'] as string) || '';
      return createNew(cwd, kernelName);
    }
  });

  // Add a launcher item if the launcher is available.
  if (launcher) {
    void services.ready.then(() => {
      let disposables: DisposableSet | null = null;
      const onSpecsChanged = () => {
        if (disposables) {
          disposables.dispose();
          disposables = null;
        }
        const specs = services.kernelspecs.specs;
        if (!specs) {
          return;
        }
        disposables = new DisposableSet();

        for (const name in specs.kernelspecs) {
          const rank = name === specs.default ? 0 : Infinity;
          const spec = specs.kernelspecs[name]!;
          let kernelIconUrl = spec.resources['logo-64x64'];
          disposables.add(
            launcher.add({
              command: CommandIDs.createNew,
              args: { isLauncher: true, kernelName: name },
              category: trans.__('Notebook'),
              rank,
              kernelIconUrl,
              metadata: {
                kernel: JSONExt.deepCopy(
                  spec.metadata || {}
                ) as ReadonlyJSONValue
              }
            })
          );
        }
      };
      onSpecsChanged();
      services.kernelspecs.specsChanged.connect(onSpecsChanged);
    });
  }
  return tracker;
}

// Get the current widget and activate unless the args specify otherwise.
function getCurrent(
  tracker: INotebookTracker,
  shell: JupyterFrontEnd.IShell,
  args: ReadonlyPartialJSONObject
): NotebookPanel | null {
  const widget = tracker.currentWidget;
  const activate = args['activate'] !== false;

  if (activate && widget) {
    shell.activateById(widget.id);
  }
  return widget;
}

/**
 * Add the notebook commands to the application's command registry.
 */
function addCommands(
  app: JupyterFrontEnd,
  tracker: NotebookTracker,
  translator: ITranslator,
  sessionDialogs: ISessionContextDialogs | null
): void {
  const trans = translator.load('jupyterlab');
  const { commands, shell } = app;

  sessionDialogs = sessionDialogs ?? sessionContextDialogs;


  const isEnabled = (): boolean => {
    return Private.isEnabled(shell, tracker);
  };

  const isEnabledAndSingleSelected = (): boolean => {
    return Private.isEnabledAndSingleSelected(shell, tracker);
  };


  const refreshCellCollapsed = (notebook: Notebook): void => {
    for (const cell of notebook.widgets) {
      if (cell instanceof MarkdownCell && (cell as MarkdownCell).headingCollapsed) {
        NotebookActions.setHeadingCollapse(cell as MarkdownCell, true, notebook);
      }
      if (cell.model.id === notebook.activeCell?.model?.id) {
        NotebookActions.expandParent(cell, notebook);
      }
    }
  };

const isEnabledAndHeadingSelected = (): boolean => {
    return Private.isEnabledAndHeadingSelected(shell, tracker);
  };

  // Set up signal handler to keep the collapse state consistent
  tracker.currentChanged.connect(
    (sender: NotebookTracker, panel: NotebookPanel) => {
      if (!panel?.content?.model?.cells) {
        return;
      }
      panel.content.model.cells.changed.connect(
        (
          list: IObservableUndoableList<ICellModel>,
          args: IObservableList.IChangedArgs<ICellModel>
        ) => {
          // Might be overkill to refresh this every time, but
          // it helps to keep the collapse state consistent.
          refreshCellCollapsed(panel.content);
        }
      );
      panel.content.activeCellChanged.connect(
        (notebook: Notebook, cell: Cell) => {
          NotebookActions.expandParent(cell, notebook);
        }
      );
    }
  );

  commands.addCommand(CommandIDs.runAndAdvance, {
    label: trans.__('Run Selected Cells'),
    execute: args => {
      const current = getCurrent(tracker, shell, args);

      if (current) {
        const { context, content } = current;
        if (content instanceof DataflowNotebook) {
          return DataflowNotebookActions.runAndAdvance(content, context.sessionContext);
        } else {
          return NotebookActions.runAndAdvance(content, context.sessionContext);
        }
      }
    },
    isEnabled
  });
  commands.addCommand(CommandIDs.run, {
    label: trans.__("Run Selected Cells and Do not Advance"),
    execute: args => {
      const current = getCurrent(tracker, shell, args);

      if (current) {
        const { context, content } = current;
        if (content instanceof DataflowNotebook) {
          return DataflowNotebookActions.run(content, context.sessionContext);
        } else {
          return NotebookActions.run(content, context.sessionContext);
        }
      }
    },
    isEnabled
  });
  commands.addCommand(CommandIDs.runAndInsert, {
    label: trans.__('Run Selected Cells and Insert Below'),
    execute: args => {
      const current = getCurrent(tracker, shell, args);

      if (current) {
        const { context, content } = current;
        if (content instanceof DataflowNotebook) {
          return DataflowNotebookActions.runAndInsert(content, context.sessionContext);
        } else {
          return NotebookActions.runAndInsert(content, context.sessionContext);
        }
      }
    },
    isEnabled
  });
  commands.addCommand(CommandIDs.runAll, {
    label: trans.__('Run All Cells'),
    execute: args => {
      const current = getCurrent(tracker, shell, args);

      if (current) {
        const { context, content } = current;
        if (content instanceof DataflowNotebook) {
          return DataflowNotebookActions.runAll(content, context.sessionContext);
        } else {
          return NotebookActions.runAll(content, context.sessionContext);
        }
      }
    },
    isEnabled
  });
  commands.addCommand(CommandIDs.runAllAbove, {
    label: trans.__('Run All Above Selected Cell'),
    execute: args => {
      const current = getCurrent(tracker, shell, args);

      if (current) {
        const { context, content } = current;
        if (content instanceof DataflowNotebook) {
          return DataflowNotebookActions.runAllAbove(content, context.sessionContext);
        } else {
          return NotebookActions.runAllAbove(content, context.sessionContext);
        }
      }
    },
    isEnabled: () => {
      // Can't run above if there are multiple cells selected,
      // or if we are at the top of the notebook.
      return (
        isEnabledAndSingleSelected() &&
        tracker.currentWidget!.content.activeCellIndex !== 0
      );
    }
  });
  commands.addCommand(CommandIDs.runAllBelow, {
    label: trans.__('Run Selected Cell and All Below'),
    execute: args => {
      const current = getCurrent(tracker, shell, args);

      if (current) {
        const { context, content } = current;
        if (content instanceof DataflowNotebook) {
          return DataflowNotebookActions.runAllBelow(content, context.sessionContext);
        } else {
          return NotebookActions.runAllAbove(content, context.sessionContext);
        }
      }
    },
    isEnabled: () => {
      // Can't run below if there are multiple cells selected,
      // or if we are at the bottom of the notebook.
      return (
        isEnabledAndSingleSelected() &&
        tracker.currentWidget!.content.activeCellIndex !==
          tracker.currentWidget!.content.widgets.length - 1
      );
    }
  });
  commands.addCommand(CommandIDs.renderAllMarkdown, {
    label: trans.__('Render All Markdown Cells'),
    execute: args => {
      const current = getCurrent(tracker, shell, args);
      if (current) {
        const { context, content } = current;
        if (content instanceof DataflowNotebook) {
          return DataflowNotebookActions.renderAllMarkdown(
            content,
            context.sessionContext
          );
        } else {
          return NotebookActions.renderAllMarkdown(
            content,
            context.sessionContext
          );
        }
      }
    },
    isEnabled
  });
  commands.addCommand(CommandIDs.restart, {
    label: trans.__('Restart Kernel…'),
    execute: args => {
      const current = getCurrent(tracker, shell, args);

      if (current) {
        return sessionDialogs!.restart(current.sessionContext, translator);
      }
    },
    isEnabled
  });
  commands.addCommand(CommandIDs.closeAndShutdown, {
    label: trans.__('Close and Shut Down'),
    execute: args => {
      const current = getCurrent(tracker, shell, args);

      if (!current) {
        return;
      }

      const fileName = current.title.label;

      return showDialog({
        title: trans.__('Shut down the notebook?'),
        body: trans.__('Are you sure you want to close "%1"?', fileName),
        buttons: [Dialog.cancelButton(), Dialog.warnButton()]
      }).then(result => {
        if (result.button.accept) {
          return current.context.sessionContext.shutdown().then(() => {
            current.dispose();
          });
        }
      });
    },
    isEnabled
  });
  commands.addCommand(CommandIDs.trust, {
    label: () => trans.__('Trust Notebook'),
    execute: args => {
      const current = getCurrent(tracker, shell, args);
      if (current) {
        const { context, content } = current;
        return NotebookActions.trust(content).then(() => context.save());
      }
    },
    isEnabled
  });
  commands.addCommand(CommandIDs.restartClear, {
    label: trans.__('Restart Kernel and Clear All Outputs…'),
    execute: args => {
      const current = getCurrent(tracker, shell, args);

      if (current) {
        const { content, sessionContext } = current;

        return sessionDialogs!.restart(sessionContext, translator).then(() => {
          NotebookActions.clearAllOutputs(content);
        });
      }
    },
    isEnabled
  });
  commands.addCommand(CommandIDs.restartAndRunToSelected, {
    label: trans.__('Restart Kernel and Run up to Selected Cell…'),
    execute: args => {
      const current = getCurrent(tracker, shell, args);
      if (current) {
        const { context, content } = current;
        if (content instanceof DataflowNotebook) {
          return sessionDialogs!
            .restart(current.sessionContext, translator)
            .then(restarted => {
              if (restarted) {
                void DataflowNotebookActions.runAllAbove(
                  content,
                  context.sessionContext
                ).then(executed => {
                  if (executed || content.activeCellIndex === 0) {
                    void DataflowNotebookActions.run(content, context.sessionContext);
                  }
                });
              }
            });
          } else {
            return sessionDialogs!
            .restart(current.sessionContext, translator)
            .then(restarted => {
              if (restarted) {
                void NotebookActions.runAllAbove(
                  content,
                  context.sessionContext
                ).then(executed => {
                  if (executed || content.activeCellIndex === 0) {
                    void NotebookActions.run(content, context.sessionContext);
                  }
                });
              }
            });            
          }
      }
    },
    isEnabled: isEnabledAndSingleSelected
  });
  commands.addCommand(CommandIDs.restartRunAll, {
    label: trans.__('Restart Kernel and Run All Cells…'),
    execute: args => {
      const current = getCurrent(tracker, shell, args);

      if (current) {
        const { context, content, sessionContext } = current;

        if (content instanceof DataflowNotebook) {
          return sessionDialogs!
            .restart(sessionContext, translator)
            .then(restarted => {
              if (restarted) {
                void DataflowNotebookActions.runAll(content, context.sessionContext);
              }
              return restarted;
            });
          } else {
            return sessionDialogs!
            .restart(sessionContext, translator)
            .then(restarted => {
              if (restarted) {
                void NotebookActions.runAll(content, context.sessionContext);
              }
              return restarted;
            });            
          }
      }
    },
    isEnabled
  });
  commands.addCommand(CommandIDs.clearAllOutputs, {
    label: trans.__('Clear All Outputs'),
    execute: args => {
      const current = getCurrent(tracker, shell, args);

      if (current) {
        return NotebookActions.clearAllOutputs(current.content);
      }
    },
    isEnabled
  });
  commands.addCommand(CommandIDs.clearOutputs, {
    label: trans.__('Clear Outputs'),
    execute: args => {
      const current = getCurrent(tracker, shell, args);

      if (current) {
        return NotebookActions.clearOutputs(current.content);
      }
    },
    isEnabled
  });
  commands.addCommand(CommandIDs.interrupt, {
    label: trans.__('Interrupt Kernel'),
    execute: args => {
      const current = getCurrent(tracker, shell, args);

      if (!current) {
        return;
      }

      const kernel = current.context.sessionContext.session?.kernel;

      if (kernel) {
        return kernel.interrupt();
      }
    },
    isEnabled
  });
  commands.addCommand(CommandIDs.toCode, {
    label: trans.__('Change to Code Cell Type'),
    execute: args => {
      const current = getCurrent(tracker, shell, args);

      if (current) {
        return NotebookActions.changeCellType(current.content, 'code');
      }
    },
    isEnabled
  });
  commands.addCommand(CommandIDs.toMarkdown, {
    label: trans.__('Change to Markdown Cell Type'),
    execute: args => {
      const current = getCurrent(tracker, shell, args);

      if (current) {
        return NotebookActions.changeCellType(current.content, 'markdown');
      }
    },
    isEnabled
  });
  commands.addCommand(CommandIDs.toRaw, {
    label: trans.__('Change to Raw Cell Type'),
    execute: args => {
      const current = getCurrent(tracker, shell, args);

      if (current) {
        return NotebookActions.changeCellType(current.content, 'raw');
      }
    },
    isEnabled
  });
  
  commands.addCommand(CommandIDs.cut, {
    label: trans.__('Cut Cells'),
    caption: trans.__('Cut the selected cells'),
    execute: args => {
      const current = getCurrent(tracker, shell, args);

      if (current) {
        return NotebookActions.cut(current.content);
      }
    },
    icon: args => (args.toolbar ? cutIcon : undefined),
    isEnabled
  });
  commands.addCommand(CommandIDs.copy, {
    label: trans.__('Copy Cells'),
    caption: trans.__('Copy the selected cells'),
    execute: args => {
      const current = getCurrent(tracker, shell, args);

      if (current) {
        return NotebookActions.copy(current.content);
      }
    },
    icon: args => (args.toolbar ? copyIcon : ''),
    isEnabled
  });
  commands.addCommand(CommandIDs.pasteBelow, {
    label: trans.__('Paste Cells Below'),
    caption: trans.__('Paste cells from the clipboard'),
    execute: args => {
      const current = getCurrent(tracker, shell, args);

      if (current) {
        return NotebookActions.paste(current.content, 'below');
      }
    },
    icon: args => (args.toolbar ? pasteIcon : undefined),
    isEnabled
  });
  commands.addCommand(CommandIDs.pasteAbove, {
    label: trans.__('Paste Cells Above'),
    execute: args => {
      const current = getCurrent(tracker, shell, args);

      if (current) {
        return NotebookActions.paste(current.content, 'above');
      }
    },
    isEnabled
  });
  commands.addCommand(CommandIDs.duplicateBelow, {
    label: trans.__('Duplicate Cells Below'),
    caption: trans.__(
      'Copy the selected cells and paste them below the selection'
    ),
    execute: args => {
      const current = getCurrent(tracker, shell, args);

      if (current) {
        NotebookActions.duplicate(current.content, 'belowSelected');
      }
    },
    icon: args => (args.toolbar ? duplicateIcon : ''),
    isEnabled
  });
  commands.addCommand(CommandIDs.pasteAndReplace, {
    label: trans.__('Paste Cells and Replace'),
    execute: args => {
      const current = getCurrent(tracker, shell, args);

      if (current) {
        return NotebookActions.paste(current.content, 'replace');
      }
    },
    isEnabled
  });
  commands.addCommand(CommandIDs.deleteCell, {
    label: trans.__('Delete Cells'),
    execute: args => {
      const current = getCurrent(tracker, shell, args);

      if (current) {
        return NotebookActions.deleteCells(current.content);
      }
    },
    isEnabled
  });
  commands.addCommand(CommandIDs.split, {
    label: trans.__('Split Cell'),
    execute: args => {
      const current = getCurrent(tracker, shell, args);

      if (current) {
        return NotebookActions.splitCell(current.content);
      }
    },
    isEnabled
  });
  commands.addCommand(CommandIDs.merge, {
    label: trans.__('Merge Selected Cells'),
    execute: args => {
      const current = getCurrent(tracker, shell, args);

      if (current) {
        return NotebookActions.mergeCells(current.content);
      }
    },
    isEnabled
  });
  commands.addCommand(CommandIDs.mergeAbove, {
    label: trans.__('Merge Cell Above'),
    execute: args => {
      const current = getCurrent(tracker, shell, args);

      if (current) {
        return NotebookActions.mergeCells(current.content, true);
      }
    },
    isEnabled
  });
  commands.addCommand(CommandIDs.mergeBelow, {
    label: trans.__('Merge Cell Below'),
    execute: args => {
      const current = getCurrent(tracker, shell, args);

      if (current) {
        return NotebookActions.mergeCells(current.content, false);
      }
    },
    isEnabled
  });
  commands.addCommand(CommandIDs.insertAbove, {
    label: trans.__('Insert Cell Above'),
    execute: args => {
      const current = getCurrent(tracker, shell, args);

      if (current) {
        return NotebookActions.insertAbove(current.content);
      }
    },
    icon: args => (args.toolbar ? addAboveIcon : undefined),
    isEnabled
  });
  commands.addCommand(CommandIDs.insertBelow, {
    label: trans.__('Insert Cell Below'),
    caption: trans.__('Insert a cell below'),
    execute: args => {
      const current = getCurrent(tracker, shell, args);

      if (current) {
        return NotebookActions.insertBelow(current.content);
      }
    },
    icon: args => (args.toolbar ? addBelowIcon : undefined),
    isEnabled
  });
  commands.addCommand(CommandIDs.selectAbove, {
    label: trans.__('Select Cell Above'),
    execute: args => {
      const current = getCurrent(tracker, shell, args);

      if (current) {
        return NotebookActions.selectAbove(current.content);
      }
    },
    isEnabled
  });
  commands.addCommand(CommandIDs.selectBelow, {
    label: trans.__('Select Cell Below'),
    execute: args => {
      const current = getCurrent(tracker, shell, args);

      if (current) {
        return NotebookActions.selectBelow(current.content);
      }
    },
    isEnabled
  });
  commands.addCommand(CommandIDs.extendAbove, {
    label: trans.__('Extend Selection Above'),
    execute: args => {
      const current = getCurrent(tracker, shell, args);

      if (current) {
        return NotebookActions.extendSelectionAbove(current.content);
      }
    },
    isEnabled
  });
  commands.addCommand(CommandIDs.extendTop, {
    label: trans.__('Extend Selection to Top'),
    execute: args => {
      const current = getCurrent(tracker, shell, args);

      if (current) {
        return NotebookActions.extendSelectionAbove(current.content, true);
      }
    },
    isEnabled
  });
  commands.addCommand(CommandIDs.extendBelow, {
    label: trans.__('Extend Selection Below'),
    execute: args => {
      const current = getCurrent(tracker, shell, args);

      if (current) {
        return NotebookActions.extendSelectionBelow(current.content);
      }
    },
    isEnabled
  });
  commands.addCommand(CommandIDs.extendBottom, {
    label: trans.__('Extend Selection to Bottom'),
    execute: args => {
      const current = getCurrent(tracker, shell, args);

      if (current) {
        return NotebookActions.extendSelectionBelow(current.content, true);
      }
    },
    isEnabled
  });
  commands.addCommand(CommandIDs.selectAll, {
    label: trans.__('Select All Cells'),
    execute: args => {
      const current = getCurrent(tracker, shell, args);

      if (current) {
        return NotebookActions.selectAll(current.content);
      }
    },
    isEnabled
  });
  commands.addCommand(CommandIDs.deselectAll, {
    label: trans.__('Deselect All Cells'),
    execute: args => {
      const current = getCurrent(tracker, shell, args);

      if (current) {
        return NotebookActions.deselectAll(current.content);
      }
    },
    isEnabled
  });
  commands.addCommand(CommandIDs.moveUp, {
    label: trans.__('Move Cells Up'),
    execute: args => {
      const current = getCurrent(tracker, shell, args);

      if (current) {
        return NotebookActions.moveUp(current.content);
      }
    },
    isEnabled,
    icon: args => (args.toolbar ? moveUpIcon : undefined)
  });
  commands.addCommand(CommandIDs.moveDown, {
    label: trans.__('Move Cells Down'),
    execute: args => {
      const current = getCurrent(tracker, shell, args);

      if (current) {
        return NotebookActions.moveDown(current.content);
      }
    },
    isEnabled,
    icon: args => (args.toolbar ? moveDownIcon : undefined)
  });
  commands.addCommand(CommandIDs.toggleAllLines, {
    label: trans.__('Toggle All Line Numbers'),
    execute: args => {
      const current = getCurrent(tracker, shell, args);

      if (current) {
        return NotebookActions.toggleAllLineNumbers(current.content);
      }
    },
    isEnabled
  });
  commands.addCommand(CommandIDs.commandMode, {
    label: trans.__('Enter Command Mode'),
    execute: args => {
      const current = getCurrent(tracker, shell, args);

      if (current) {
        current.content.mode = 'command';
      }
    },
    isEnabled
  });
  commands.addCommand(CommandIDs.editMode, {
    label: trans.__('Enter Edit Mode'),
    execute: args => {
      const current = getCurrent(tracker, shell, args);

      if (current) {
        current.content.mode = 'edit';
      }
    },
    isEnabled
  });
  commands.addCommand(CommandIDs.undoCellAction, {
    label: trans.__('Undo Cell Operation'),
    execute: args => {
      const current = getCurrent(tracker, shell, args);

      if (current) {
        return NotebookActions.undo(current.content);
      }
    },
    isEnabled
  });
  commands.addCommand(CommandIDs.redoCellAction, {
    label: trans.__('Redo Cell Operation'),
    execute: args => {
      const current = getCurrent(tracker, shell, args);

      if (current) {
        return NotebookActions.redo(current.content);
      }
    },
    isEnabled
  });
  commands.addCommand(CommandIDs.changeKernel, {
    label: trans.__('Change Kernel…'),
    execute: args => {
      const current = getCurrent(tracker, shell, args);

      if (current) {
        return sessionDialogs!.selectKernel(
          current.context.sessionContext,
          translator
        );
      }
    },
    isEnabled
  });
  commands.addCommand(CommandIDs.reconnectToKernel, {
    label: trans.__('Reconnect To Kernel'),
    execute: args => {
      const current = getCurrent(tracker, shell, args);

      if (!current) {
        return;
      }

      const kernel = current.context.sessionContext.session?.kernel;

      if (kernel) {
        return kernel.reconnect();
      }
    },
    isEnabled
  });
  commands.addCommand(CommandIDs.markdown1, {
    label: trans.__('Change to Heading 1'),
    execute: args => {
      const current = getCurrent(tracker, shell, args);

      if (current) {
        return NotebookActions.setMarkdownHeader(current.content, 1);
      }
    },
    isEnabled
  });
  commands.addCommand(CommandIDs.markdown2, {
    label: trans.__('Change to Heading 2'),
    execute: args => {
      const current = getCurrent(tracker, shell, args);

      if (current) {
        return NotebookActions.setMarkdownHeader(current.content, 2);
      }
    },
    isEnabled
  });
  commands.addCommand(CommandIDs.markdown3, {
    label: trans.__('Change to Heading 3'),
    execute: args => {
      const current = getCurrent(tracker, shell, args);

      if (current) {
        return NotebookActions.setMarkdownHeader(current.content, 3);
      }
    },
    isEnabled
  });
  commands.addCommand(CommandIDs.markdown4, {
    label: trans.__('Change to Heading 4'),
    execute: args => {
      const current = getCurrent(tracker, shell, args);

      if (current) {
        return NotebookActions.setMarkdownHeader(current.content, 4);
      }
    },
    isEnabled
  });
  commands.addCommand(CommandIDs.markdown5, {
    label: trans.__('Change to Heading 5'),
    execute: args => {
      const current = getCurrent(tracker, shell, args);

      if (current) {
        return NotebookActions.setMarkdownHeader(current.content, 5);
      }
    },
    isEnabled
  });
  commands.addCommand(CommandIDs.markdown6, {
    label: trans.__('Change to Heading 6'),
    execute: args => {
      const current = getCurrent(tracker, shell, args);

      if (current) {
        return NotebookActions.setMarkdownHeader(current.content, 6);
      }
    },
    isEnabled
  });
  commands.addCommand(CommandIDs.hideCode, {
    label: trans.__('Collapse Selected Code'),
    execute: args => {
      const current = getCurrent(tracker, shell, args);

      if (current) {
        return NotebookActions.hideCode(current.content);
      }
    },
    isEnabled
  });
  commands.addCommand(CommandIDs.showCode, {
    label: trans.__('Expand Selected Code'),
    execute: args => {
      const current = getCurrent(tracker, shell, args);

      if (current) {
        return NotebookActions.showCode(current.content);
      }
    },
    isEnabled
  });
  commands.addCommand(CommandIDs.hideAllCode, {
    label: trans.__('Collapse All Code'),
    execute: args => {
      const current = getCurrent(tracker, shell, args);

      if (current) {
        return NotebookActions.hideAllCode(current.content);
      }
    },
    isEnabled
  });
  commands.addCommand(CommandIDs.showAllCode, {
    label: trans.__('Expand All Code'),
    execute: args => {
      const current = getCurrent(tracker, shell, args);

      if (current) {
        return NotebookActions.showAllCode(current.content);
      }
    },
    isEnabled
  });
  commands.addCommand(CommandIDs.hideOutput, {
    label: trans.__('Collapse Selected Outputs'),
    execute: args => {
      const current = getCurrent(tracker, shell, args);

      if (current) {
        return NotebookActions.hideOutput(current.content);
      }
    },
    isEnabled
  });
  commands.addCommand(CommandIDs.showOutput, {
    label: trans.__('Expand Selected Outputs'),
    execute: args => {
      const current = getCurrent(tracker, shell, args);

      if (current) {
        return NotebookActions.showOutput(current.content);
      }
    },
    isEnabled
  });
  commands.addCommand(CommandIDs.hideAllOutputs, {
    label: trans.__('Collapse All Outputs'),
    execute: args => {
      const current = getCurrent(tracker, shell, args);

      if (current) {
        return NotebookActions.hideAllOutputs(current.content);
      }
    },
    isEnabled
  });

  commands.addCommand(CommandIDs.toggleRenderSideBySideCurrentNotebook, {
    label: trans.__('Render Side-by-Side'),
    execute: args => {
      const current = getCurrent(tracker, shell, args);
      if (current) {
        if (current.content.renderingLayout === 'side-by-side') {
          return NotebookActions.renderDefault(current.content);
        }
        return NotebookActions.renderSideBySide(current.content);
      }
    },
    isEnabled,
    isToggled: args => {
      const current = getCurrent(tracker, shell, { ...args, activate: false });
      if (current) {
        return current.content.renderingLayout === 'side-by-side';
      } else {
        return false;
      }
    }
  });

  commands.addCommand(CommandIDs.setSideBySideRatio, {
    label: trans.__('Set side-by-side ratio'),
    execute: args => {
      InputDialog.getNumber({
        title: trans.__('Width of the output in side-by-side mode'),
        value: 1
      })
        .then(result => {
          if (result.value) {
            document.documentElement.style.setProperty(
              '--jp-side-by-side-output-size',
              `${result.value}fr`
            );
          }
        })
        .catch(console.error);
    }
  });
  commands.addCommand(CommandIDs.showAllOutputs, {
    label: trans.__('Expand All Outputs'),
    execute: args => {
      const current = getCurrent(tracker, shell, args);

      if (current) {
        return NotebookActions.showAllOutputs(current.content);
      }
    },
    isEnabled
  });
  commands.addCommand(CommandIDs.enableOutputScrolling, {
    label: trans.__('Enable Scrolling for Outputs'),
    execute: args => {
      const current = getCurrent(tracker, shell, args);

      if (current) {
        return NotebookActions.enableOutputScrolling(current.content);
      }
    },
    isEnabled
  });
  commands.addCommand(CommandIDs.disableOutputScrolling, {
    label: trans.__('Disable Scrolling for Outputs'),
    execute: args => {
      const current = getCurrent(tracker, shell, args);

      if (current) {
        return NotebookActions.disableOutputScrolling(current.content);
      }
    },
    isEnabled
  });
  commands.addCommand(CommandIDs.selectLastRunCell, {
    label: trans.__('Select current running or last run cell'),
    execute: args => {
      const current = getCurrent(tracker, shell, args);

      if (current) {
        return NotebookActions.selectLastRunCell(current.content);
      }
    },
    isEnabled
  });
  commands.addCommand(CommandIDs.replaceSelection, {
    label: trans.__('Replace Selection in Notebook Cell'),
    execute: args => {
      const current = getCurrent(tracker, shell, args);
      const text: string = (args['text'] as string) || '';
      if (current) {
        return NotebookActions.replaceSelection(current.content, text);
      }
    },
    isEnabled
  });
  commands.addCommand(CommandIDs.toggleCollapseCmd, {
    label: 'Toggle Collapse Notebook Heading',
    execute: args => {
      const current = getCurrent(tracker, shell, args);
      if (current) {
        return NotebookActions.toggleCurrentHeadingCollapse(current.content);
      }
    },
    isEnabled: isEnabledAndHeadingSelected
  });
  commands.addCommand(CommandIDs.collapseAllCmd, {
    label: 'Collapse All Cells',
    execute: args => {
      const current = getCurrent(tracker, shell, args);
      if (current) {
        return NotebookActions.collapseAll(current.content);
      }
    }
  });
  commands.addCommand(CommandIDs.expandAllCmd, {
    label: 'Expand All Headings',
    execute: args => {
      const current = getCurrent(tracker, shell, args);
      if (current) {
        return NotebookActions.expandAllHeadings(current.content);
      }
    }
  });

  commands.addCommand(CommandIDs.tagCell, {
    label: trans.__('Tag Cell'),
    execute: args => {
      const cell = tracker.currentWidget?.content.activeCell as CodeCell;

      if (cell == null) {
        return;
      }

      const inputArea = cell.inputArea as DataflowInputArea;
      const value = prompt("Tag this cell please:", "");
      inputArea.addTag(value);
    }
  });
}

/**
 * Populate the application's command palette with notebook commands.
 */
function populatePalette(
  palette: ICommandPalette,
  translator: ITranslator
): void {
  const trans = translator.load('jupyterlab');
  let category = trans.__('Notebook Operations');

  [
    CommandIDs.interrupt,
    CommandIDs.restart,
    CommandIDs.restartClear,
    CommandIDs.restartRunAll,
    CommandIDs.runAll,
    CommandIDs.renderAllMarkdown,
    CommandIDs.runAllAbove,
    CommandIDs.runAllBelow,
    CommandIDs.restartAndRunToSelected,
    CommandIDs.selectAll,
    CommandIDs.deselectAll,
    CommandIDs.clearAllOutputs,
    CommandIDs.toggleAllLines,
    CommandIDs.editMode,
    CommandIDs.commandMode,
    CommandIDs.changeKernel,
    CommandIDs.reconnectToKernel,
    CommandIDs.createConsole,
    CommandIDs.closeAndShutdown,
    CommandIDs.trust,
    CommandIDs.toggleCollapseCmd,
    CommandIDs.collapseAllCmd,
    CommandIDs.expandAllCmd
  ].forEach(command => {
    palette.addItem({ command, category });
  });

  palette.addItem({
    command: CommandIDs.createNew,
    category,
    args: { isPalette: true }
  });

  category = trans.__('Notebook Cell Operations');
  [
    CommandIDs.run,
    CommandIDs.runAndAdvance,
    CommandIDs.runAndInsert,
    CommandIDs.runInConsole,
    CommandIDs.clearOutputs,
    CommandIDs.toCode,
    CommandIDs.toMarkdown,
    CommandIDs.toRaw,
    CommandIDs.cut,
    CommandIDs.copy,
    CommandIDs.pasteBelow,
    CommandIDs.pasteAbove,
    CommandIDs.pasteAndReplace,
    CommandIDs.deleteCell,
    CommandIDs.split,
    CommandIDs.merge,
    CommandIDs.mergeAbove,
    CommandIDs.mergeBelow,
    CommandIDs.insertAbove,
    CommandIDs.insertBelow,
    CommandIDs.selectAbove,
    CommandIDs.selectBelow,
    CommandIDs.extendAbove,
    CommandIDs.extendTop,
    CommandIDs.extendBelow,
    CommandIDs.extendBottom,
    CommandIDs.moveDown,
    CommandIDs.moveUp,
    CommandIDs.tagCell,
    CommandIDs.undoCellAction,
    CommandIDs.redoCellAction,
    CommandIDs.markdown1,
    CommandIDs.markdown2,
    CommandIDs.markdown3,
    CommandIDs.markdown4,
    CommandIDs.markdown5,
    CommandIDs.markdown6,
    CommandIDs.hideCode,
    CommandIDs.showCode,
    CommandIDs.hideAllCode,
    CommandIDs.showAllCode,
    CommandIDs.hideOutput,
    CommandIDs.showOutput,
    CommandIDs.hideAllOutputs,
    CommandIDs.showAllOutputs,
    CommandIDs.toggleRenderSideBySideCurrentNotebook,
    CommandIDs.setSideBySideRatio,
    CommandIDs.enableOutputScrolling,
    CommandIDs.disableOutputScrolling
  ].forEach(command => {
    palette.addItem({ command, category });
  });
}

/**
 * Populates the application menus for the notebook.
 */
function populateMenus(
  app: JupyterFrontEnd,
  mainMenu: IMainMenu,
  tracker: INotebookTracker,
  translator: ITranslator,
  sessionDialogs: ISessionContextDialogs | null
): void {
  const trans = translator.load('jupyterlab');
  const { commands } = app;
  sessionDialogs = sessionDialogs || sessionContextDialogs;

  // Add undo/redo hooks to the edit menu.
  mainMenu.editMenu.undoers.add({
    tracker: tracker,
    undo: widget => {
      widget.content.activeCell?.editor.undo();
    },
    redo: widget => {
      widget.content.activeCell?.editor.redo();
    }
  } as IEditMenu.IUndoer<NotebookPanel>);

  // Add a clearer to the edit menu
  mainMenu.editMenu.clearers.add({
    tracker: tracker,
    clearCurrentLabel: (n: number) => trans.__('Clear Output'),
    clearAllLabel: (n: number) => {
      return trans.__('Clear All Outputs');
    },
    clearCurrent: (current: NotebookPanel) => {
      return NotebookActions.clearOutputs(current.content);
    },
    clearAll: (current: NotebookPanel) => {
      return NotebookActions.clearAllOutputs(current.content);
    }
  } as IEditMenu.IClearer<NotebookPanel>);

  // Add a close and shutdown command to the file menu.
  mainMenu.fileMenu.closeAndCleaners.add({
    tracker: tracker,
    closeAndCleanupLabel: (n: number) =>
      trans.__('Close and Shutdown Notebook'),
    closeAndCleanup: (current: NotebookPanel) => {
      const fileName = current.title.label;
      return showDialog({
        title: trans.__('Shut down the Notebook?'),
        body: trans.__('Are you sure you want to close "%1"?', fileName),
        buttons: [Dialog.cancelButton(), Dialog.warnButton()]
      }).then(result => {
        if (result.button.accept) {
          return current.context.sessionContext.shutdown().then(() => {
            current.dispose();
          });
        }
      });
    }
  } as IFileMenu.ICloseAndCleaner<NotebookPanel>);

  // Add a kernel user to the Kernel menu
  mainMenu.kernelMenu.kernelUsers.add({
    tracker: tracker,
    interruptKernel: current => {
      const kernel = current.sessionContext.session?.kernel;
      if (kernel) {
        return kernel.interrupt();
      }
      return Promise.resolve(void 0);
    },
    reconnectToKernel: current => {
      const kernel = current.sessionContext.session?.kernel;
      if (kernel) {
        return kernel.reconnect();
      }
      return Promise.resolve(void 0);
    },
    restartKernelAndClearLabel: (n: number) =>
      trans.__('Restart Kernel and Clear All Outputs…'),
    restartKernel: current =>
      sessionDialogs!.restart(current.sessionContext, translator),
    restartKernelAndClear: current => {
      return sessionDialogs!
        .restart(current.sessionContext, translator)
        .then(restarted => {
          if (restarted) {
            NotebookActions.clearAllOutputs(current.content);
          }
          return restarted;
        });
    },
    changeKernel: current =>
      sessionDialogs!.selectKernel(current.sessionContext, translator),
    shutdownKernel: current => current.sessionContext.shutdown()
  } as IKernelMenu.IKernelUser<NotebookPanel>);

  // Add a console creator the the Kernel menu
  mainMenu.fileMenu.consoleCreators.add({
    tracker: tracker,
    createConsoleLabel: (n: number) => trans.__('New Console for Notebook'),
    createConsole: current => Private.createConsole(commands, current, true)
  } as IFileMenu.IConsoleCreator<NotebookPanel>);

  // Add an IEditorViewer to the application view menu
  mainMenu.viewMenu.editorViewers.add({
    tracker: tracker,
    toggleLineNumbers: widget => {
      NotebookActions.toggleAllLineNumbers(widget.content);
    },
    lineNumbersToggled: widget => {
      const config = widget.content.editorConfig;
      return !!(
        config.code.lineNumbers &&
        config.markdown.lineNumbers &&
        config.raw.lineNumbers
      );
    }
  } as IViewMenu.IEditorViewer<NotebookPanel>);

  // Add an ICodeRunner to the application run menu
  mainMenu.runMenu.codeRunners.add({
    tracker: tracker,
    runLabel: (n: number) => trans.__('Run Selected Cells'),
    runCaption: (n: number) => trans.__('Run the selected cells and advance'),
    runAllLabel: (n: number) => trans.__('Run All Cells'),
    runAllCaption: (n: number) => trans.__('Run the all notebook cells'),
    restartAndRunAllLabel: (n: number) =>
      trans.__('Restart Kernel and Run All Cells…'),
    restartAndRunAllCaption: (n: number) =>
      trans.__('Restart the kernel, then re-run the whole notebook'),
    run: current => {
      const { context, content } = current;
      if (content instanceof DataflowNotebook) {
        return DataflowNotebookActions.runAndAdvance(
          content,
          context.sessionContext
        ).then(() => void 0);
      } else {
        return NotebookActions.runAndAdvance(
          content,
          context.sessionContext
        ).then(() => void 0);
      }
    },
    runAll: current => {
      const { context, content } = current;
      if (content instanceof DataflowNotebook) {
        return DataflowNotebookActions.runAll(content, context.sessionContext).then(
          () => void 0
        );
      } else {
        return NotebookActions.runAll(content, context.sessionContext).then(
          () => void 0
        );
      }
    },
    restartAndRunAll: current => {
      const { context, content } = current;
      return sessionDialogs!
        .restart(context.sessionContext, translator)
        .then(restarted => {
          if (restarted) {
            if (content instanceof DataflowNotebook) {
              void DataflowNotebookActions.runAll(content, context.sessionContext);
            } else {
              void NotebookActions.runAll(content, context.sessionContext);
            }
          }
          return restarted;
        });
    }
  } as IRunMenu.ICodeRunner<NotebookPanel>);

  // Add kernel information to the application help menu.
  mainMenu.helpMenu.kernelUsers.add({
    tracker: tracker,
    getKernel: current => current.sessionContext.session?.kernel
  } as IHelpMenu.IKernelUser<NotebookPanel>);
}

/**
 * A namespace for module private functionality.
 */
namespace Private {
  /**
   * Create a console connected with a notebook kernel
   *
   * @param commands Commands registry
   * @param widget Notebook panel
   * @param activate Should the console be activated
   */
  export function createConsole(
    commands: CommandRegistry,
    widget: NotebookPanel,
    activate?: boolean
  ): Promise<void> {
    const options = {
      path: widget.context.path,
      preferredLanguage: widget.context.model.defaultKernelLanguage,
      activate: activate,
      ref: widget.id,
      insertMode: 'split-bottom'
    };

    return commands.execute('console:create', options);
  }

  /**
   * Whether there is an active notebook.
   */
  export function isEnabled(
    shell: JupyterFrontEnd.IShell,
    tracker: INotebookTracker
  ): boolean {
    return (
      tracker.currentWidget !== null &&
      tracker.currentWidget === shell.currentWidget
    );
  }

  /**
   * Whether there is an notebook active, with a single selected cell.
   */
  export function isEnabledAndSingleSelected(
    shell: JupyterFrontEnd.IShell,
    tracker: INotebookTracker
  ): boolean {
    if (!Private.isEnabled(shell, tracker)) {
      return false;
    }
    const { content } = tracker.currentWidget!;
    const index = content.activeCellIndex;
    // If there are selections that are not the active cell,
    // this command is confusing, so disable it.
    for (let i = 0; i < content.widgets.length; ++i) {
      if (content.isSelected(content.widgets[i]) && i !== index) {
        return false;
      }
    }
    return true;
  }

  /**
   * Whether there is an notebook active, with a single selected cell.
   */
  export function isEnabledAndHeadingSelected(
    shell: JupyterFrontEnd.IShell,
    tracker: INotebookTracker
  ): boolean {
    if (!Private.isEnabled(shell, tracker)) {
      return false;
    }
    const { content } = tracker.currentWidget!;
    const index = content.activeCellIndex;
    if (!(content.activeCell instanceof MarkdownCell)) {
      return false;
    }
    // If there are selections that are not the active cell,
    // this command is confusing, so disable it.
    for (let i = 0; i < content.widgets.length; ++i) {
      if (content.isSelected(content.widgets[i]) && i !== index) {
        return false;
      }
    }
    return true;
  }

  /**
   * The default Export To ... formats and their human readable labels.
   */
  export function getFormatLabels(
    translator: ITranslator
  ): { [k: string]: string } {
    translator = translator || nullTranslator;
    const trans = translator.load('jupyterlab');
    return {
      html: trans.__('HTML'),
      latex: trans.__('LaTeX'),
      markdown: trans.__('Markdown'),
      pdf: trans.__('PDF'),
      rst: trans.__('ReStructured Text'),
      script: trans.__('Executable Script'),
      slides: trans.__('Reveal.js Slides')
    };
  }

  /**
   * A widget hosting a cloned output area.
   */
  export class ClonedOutputArea extends Panel {
    constructor(options: ClonedOutputArea.IOptions) {
      super();
      const trans = (options.translator || nullTranslator).load('jupyterlab');
      this._notebook = options.notebook;
      this._index = options.index !== undefined ? options.index : -1;
      this._cell = options.cell || null;
      this.id = `LinkedOutputView-${UUID.uuid4()}`;
      this.title.label = 'Output View';
      this.title.icon = notebookIcon;
      this.title.caption = this._notebook.title.label
        ? trans.__('For Notebook: %1', this._notebook.title.label)
        : trans.__('For Notebook:');
      this.addClass('jp-LinkedOutputView');

      // Wait for the notebook to be loaded before
      // cloning the output area.
      void this._notebook.context.ready.then(() => {
        if (!this._cell) {
          this._cell = this._notebook.content.widgets[this._index] as CodeCell;
        }
        if (!this._cell || this._cell.model.type !== 'code') {
          this.dispose();
          return;
        }
        const clone = this._cell.cloneOutputArea();
        this.addWidget(clone);
      });
    }

    /**
     * The index of the cell in the notebook.
     */
    get index(): number {
      return this._cell
        ? ArrayExt.findFirstIndex(
            this._notebook.content.widgets,
            c => c === this._cell
          )
        : this._index;
    }

    /**
     * The path of the notebook for the cloned output area.
     */
    get path(): string {
      return this._notebook.context.path;
    }

    private _notebook: NotebookPanel;
    private _index: number;
    private _cell: CodeCell | null = null;
  }

  /**
   * ClonedOutputArea statics.
   */
  export namespace ClonedOutputArea {
    export interface IOptions {
      /**
       * The notebook associated with the cloned output area.
       */
      notebook: NotebookPanel;

      /**
       * The cell for which to clone the output area.
       */
      cell?: CodeCell;

      /**
       * If the cell is not available, provide the index
       * of the cell for when the notebook is loaded.
       */
      index?: number;

      /**
       * If the cell is not available, provide the index
       * of the cell for when the notebook is loaded.
       */
      translator?: ITranslator;
    }
  }
}
