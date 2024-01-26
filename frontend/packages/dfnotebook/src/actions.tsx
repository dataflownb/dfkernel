// Copyright (c) Jupyter Development Team.
// Distributed under the terms of the Modified BSD License.

import {
  Dialog,
  ISessionContext,
  ISessionContextDialogs,
  showDialog
} from '@jupyterlab/apputils';

import { signalToPromise } from '@jupyterlab/coreutils';
import * as nbformat from '@jupyterlab/nbformat';
import { KernelMessage } from '@jupyterlab/services';
import { ITranslator, nullTranslator } from '@jupyterlab/translation';
import { JSONObject } from '@lumino/coreutils';
import { findIndex } from '@lumino/algorithm';
import { ISignal, Signal } from '@lumino/signaling';
import { KernelError, Notebook } from '@jupyterlab/notebook';
import { Cell, CodeCell, ICodeCellModel, MarkdownCell } from '@jupyterlab/cells';
import { DataflowCodeCell } from '@dfnotebook/dfcells';
/**
 * A collection of actions that run against notebooks.
 *
 * #### Notes
 * All of the actions are a no-op if there is no model on the notebook.
 * The actions set the widget `mode` to `'command'` unless otherwise specified.
 * The actions will preserve the selection on the notebook widget unless
 * otherwise specified.
 * 
 * #### Dataflow Notebook Notes
 * Most of this code is copied directly from 
 * @jupyterlab/notebook/actions.tsx
 * The main change is that we modify the runCell method and need
 * everything to be able to call this.
 * 
 */
export class DataflowNotebookActions {
  /**
   * A signal that emits whenever a cell completes execution.
   */
  static get executed(): ISignal<
    any,
    {
      notebook: Notebook;
      cell: Cell;
      success: boolean;
      error?: KernelError | null;
    }
  > {
    return Private.executed;
  }

  /**
   * A signal that emits whenever a cell execution is scheduled.
   */
  static get executionScheduled(): ISignal<
    any,
    { notebook: Notebook; cell: Cell }
  > {
    return Private.executionScheduled;
  }

  /**
   * A signal that emits whenever a cell execution is scheduled.
   */
  static get selectionExecuted(): ISignal<
    any,
    { notebook: Notebook; lastCell: Cell }
  > {
    return Private.selectionExecuted;
  }

  /**
   * A private constructor for the `NotebookActions` class.
   *
   * #### Notes
   * This class can never be instantiated. Its static member `executed` will be
   * merged with the `NotebookActions` namespace. The reason it exists as a
   * standalone class is because at run time, the `Private.executed` variable
   * does not yet exist, so it needs to be referenced via a getter.
   */
  private constructor() {
    // Intentionally empty.
  }
}

/**
 * A namespace for `NotebookActions` static methods.
 */
export namespace DataflowNotebookActions {
  /**
   * Run the selected cell(s).
   *
   * @param notebook - The target notebook widget.
   * @param sessionContext - The client session object.
   * @param sessionDialogs - The session dialogs.
   * @param translator - The application translator.
   *
   * #### Notes
   * The last selected cell will be activated, but not scrolled into view.
   * The existing selection will be cleared.
   * An execution error will prevent the remaining code cells from executing.
   * All markdown cells will be rendered.
   */
  export function run(
    notebook: Notebook,
    sessionContext?: ISessionContext,
    sessionDialogs?: ISessionContextDialogs,
    translator?: ITranslator
  ): Promise<boolean> {
    if (!notebook.model || !notebook.activeCell) {
      return Promise.resolve(false);
    }

    const state = Private.getState(notebook);
    const promise = Private.runSelected(
      notebook,
      sessionContext,
      sessionDialogs,
      translator
    );

    Private.handleRunState(notebook, state, false);
    return promise;
  }

    /**
   * Run the selected cell(s) and advance to the next cell.
   *
   * @param notebook - The target notebook widget.
   * @param sessionContext - The client session object.
   * @param sessionDialogs - The session dialogs.
   * @param translator - The application translator.
   *
   * #### Notes
   * The existing selection will be cleared.
   * The cell after the last selected cell will be activated and scrolled into view.
   * An execution error will prevent the remaining code cells from executing.
   * All markdown cells will be rendered.
   * If the last selected cell is the last cell, a new code cell
   * will be created in `'edit'` mode.  The new cell creation can be undone.
   */
    export async function runAndAdvance(
      notebook: Notebook,
      sessionContext?: ISessionContext,
      sessionDialogs?: ISessionContextDialogs,
      translator?: ITranslator
    ): Promise<boolean> {
      if (!notebook.model || !notebook.activeCell) {
        return Promise.resolve(false);
      }
  
      const state = Private.getState(notebook);
      const promise = Private.runSelected(
        notebook,
        sessionContext,
        sessionDialogs,
        translator
      );
      const model = notebook.model;
  
      if (notebook.activeCellIndex === notebook.widgets.length - 1) {
        // Do not use push here, as we want an widget insertion
        // to make sure no placeholder widget is rendered.
        model.sharedModel.insertCell(notebook.widgets.length, {
          cell_type: notebook.notebookConfig.defaultCell,
          metadata:
            notebook.notebookConfig.defaultCell === 'code'
              ? {
                  // This is an empty cell created by user, thus is trusted
                  trusted: true
                }
              : {}
        });
        notebook.activeCellIndex++;
        if (notebook.activeCell?.inViewport === false) {
          await signalToPromise(notebook.activeCell.inViewportChanged, 200).catch(
            () => {
              // no-op
            }
          );
        }
        notebook.mode = 'edit';
      } else {
        notebook.activeCellIndex++;
      }
  
      Private.handleRunState(notebook, state, true);
      return promise;
    }
  
    /**
     * Run the selected cell(s) and insert a new code cell.
     *
     * @param notebook - The target notebook widget.
     * @param sessionContext - The client session object.
     * @param sessionDialogs - The session dialogs.
     * @param translator - The application translator.
     *
     * #### Notes
     * An execution error will prevent the remaining code cells from executing.
     * All markdown cells will be rendered.
     * The widget mode will be set to `'edit'` after running.
     * The existing selection will be cleared.
     * The cell insert can be undone.
     * The new cell will be scrolled into view.
     */
    export async function runAndInsert(
      notebook: Notebook,
      sessionContext?: ISessionContext,
      sessionDialogs?: ISessionContextDialogs,
      translator?: ITranslator
    ): Promise<boolean> {
      if (!notebook.model || !notebook.activeCell) {
        return Promise.resolve(false);
      }
  
      const state = Private.getState(notebook);
      const promise = Private.runSelected(
        notebook,
        sessionContext,
        sessionDialogs,
        translator
      );
      const model = notebook.model;
      model.sharedModel.insertCell(notebook.activeCellIndex + 1, {
        cell_type: notebook.notebookConfig.defaultCell,
        metadata:
          notebook.notebookConfig.defaultCell === 'code'
            ? {
                // This is an empty cell created by user, thus is trusted
                trusted: true
              }
            : {}
      });
      notebook.activeCellIndex++;
      if (notebook.activeCell?.inViewport === false) {
        await signalToPromise(notebook.activeCell.inViewportChanged, 200).catch(
          () => {
            // no-op
          }
        );
      }
      notebook.mode = 'edit';
      Private.handleRunState(notebook, state, true);
      return promise;
    }
  
    /**
     * Run all of the cells in the notebook.
     *
     * @param notebook - The target notebook widget.
     * @param sessionContext - The client session object.
     * @param sessionDialogs - The session dialogs.
     * @param translator - The application translator.
     *
     * #### Notes
     * The existing selection will be cleared.
     * An execution error will prevent the remaining code cells from executing.
     * All markdown cells will be rendered.
     * The last cell in the notebook will be activated and scrolled into view.
     */
    export function runAll(
      notebook: Notebook,
      sessionContext?: ISessionContext,
      sessionDialogs?: ISessionContextDialogs,
      translator?: ITranslator
    ): Promise<boolean> {
      if (!notebook.model || !notebook.activeCell) {
        return Promise.resolve(false);
      }
  
      const state = Private.getState(notebook);
  
      notebook.widgets.forEach(child => {
        notebook.select(child);
      });
  
      const promise = Private.runSelected(
        notebook,
        sessionContext,
        sessionDialogs,
        translator
      );
  
      Private.handleRunState(notebook, state, true);
      return promise;
    }
  
    export function renderAllMarkdown(notebook: Notebook): Promise<boolean> {
      if (!notebook.model || !notebook.activeCell) {
        return Promise.resolve(false);
      }
      const previousIndex = notebook.activeCellIndex;
      const state = Private.getState(notebook);
      notebook.widgets.forEach((child, index) => {
        if (child.model.type === 'markdown') {
          notebook.select(child);
          // This is to make sure that the activeCell
          // does not get executed
          notebook.activeCellIndex = index;
        }
      });
      if (notebook.activeCell.model.type !== 'markdown') {
        return Promise.resolve(true);
      }
      const promise = Private.runSelected(notebook);
      notebook.activeCellIndex = previousIndex;
      Private.handleRunState(notebook, state, true);
      return promise;
    }
  
    /**
     * Run all of the cells before the currently active cell (exclusive).
     *
     * @param notebook - The target notebook widget.
     * @param sessionContext - The client session object.
     * @param sessionDialogs - The session dialogs.
     * @param translator - The application translator.
     *
     * #### Notes
     * The existing selection will be cleared.
     * An execution error will prevent the remaining code cells from executing.
     * All markdown cells will be rendered.
     * The currently active cell will remain selected.
     */
    export function runAllAbove(
      notebook: Notebook,
      sessionContext?: ISessionContext,
      sessionDialogs?: ISessionContextDialogs,
      translator?: ITranslator
    ): Promise<boolean> {
      const { activeCell, activeCellIndex, model } = notebook;
  
      if (!model || !activeCell || activeCellIndex < 1) {
        return Promise.resolve(false);
      }
  
      const state = Private.getState(notebook);
  
      notebook.activeCellIndex--;
      notebook.deselectAll();
      for (let i = 0; i < notebook.activeCellIndex; ++i) {
        notebook.select(notebook.widgets[i]);
      }
  
      const promise = Private.runSelected(
        notebook,
        sessionContext,
        sessionDialogs,
        translator
      );
  
      notebook.activeCellIndex++;
      Private.handleRunState(notebook, state, true);
      return promise;
    }
  
    /**
     * Run all of the cells after the currently active cell (inclusive).
     *
     * @param notebook - The target notebook widget.
     * @param sessionContext - The client session object.
     * @param sessionDialogs - The session dialogs.
     * @param translator - The application translator.
     *
     * #### Notes
     * The existing selection will be cleared.
     * An execution error will prevent the remaining code cells from executing.
     * All markdown cells will be rendered.
     * The last cell in the notebook will be activated and scrolled into view.
     */
    export function runAllBelow(
      notebook: Notebook,
      sessionContext?: ISessionContext,
      sessionDialogs?: ISessionContextDialogs,
      translator?: ITranslator
    ): Promise<boolean> {
      if (!notebook.model || !notebook.activeCell) {
        return Promise.resolve(false);
      }
  
      const state = Private.getState(notebook);
  
      notebook.deselectAll();
      for (let i = notebook.activeCellIndex; i < notebook.widgets.length; ++i) {
        notebook.select(notebook.widgets[i]);
      }
  
      const promise = Private.runSelected(
        notebook,
        sessionContext,
        sessionDialogs,
        translator
      );
  
      Private.handleRunState(notebook, state, true);
      return promise;
    }  
}

/**
 * A namespace for private data.
 */
namespace Private {
  /**
   * A signal that emits whenever a cell completes execution.
   */
  export const executed = new Signal<
    any,
    {
      notebook: Notebook;
      cell: Cell;
      success: boolean;
      error?: KernelError | null;
    }
  >({});

  /**
   * A signal that emits whenever a cell execution is scheduled.
   */
  export const executionScheduled = new Signal<
    any,
    { notebook: Notebook; cell: Cell }
  >({});

  /**
   * A signal that emits when one notebook's cells are all executed.
   */
  export const selectionExecuted = new Signal<
    any,
    { notebook: Notebook; lastCell: Cell }
  >({});

  /**
   * The interface for a widget state.
   */
  export interface IState {
    /**
     * Whether the widget had focus.
     */
    wasFocused: boolean;

    /**
     * The active cell id before the action.
     *
     * We cannot rely on the Cell widget or model as it may be
     * discarded by action such as move.
     */
    activeCellId: string | null;
  }

  /**
   * Get the state of a widget before running an action.
   */
  export function getState(notebook: Notebook): IState {
    return {
      wasFocused: notebook.node.contains(document.activeElement),
      activeCellId: notebook.activeCell?.model.id ?? null
    };
  }

  /**
   * Handle the state of a widget after running an action.
   */
  export function handleState(
    notebook: Notebook,
    state: IState,
    scrollIfNeeded = false
  ): void {
    const { activeCell, activeCellIndex } = notebook;

    if (state.wasFocused || notebook.mode === 'edit') {
      notebook.activate();
    }

    if (scrollIfNeeded && activeCell) {
      notebook.scrollToItem(activeCellIndex, 'auto', 0).catch(reason => {
        // no-op
      });
    }
  }

  /**
   * Handle the state of a widget after running a run action.
   */
  export function handleRunState(
    notebook: Notebook,
    state: IState,
    scroll = false
  ): void {
    if (state.wasFocused || notebook.mode === 'edit') {
      notebook.activate();
    }
    const { activeCell, activeCellIndex } = notebook;
    if (scroll && activeCell) {
      notebook.scrollToItem(activeCellIndex, 'smart', 0).catch(reason => {
        // no-op
      });
    }
  }

  /**
   * Run the selected cells.
   *
   * @param notebook Notebook
   * @param sessionContext Notebook session context
   * @param sessionDialogs Session dialogs
   * @param translator Application translator
   */
  export function runSelected(
    notebook: Notebook,
    sessionContext?: ISessionContext,
    sessionDialogs?: ISessionContextDialogs,
    translator?: ITranslator
  ): Promise<boolean> {
    notebook.mode = 'command';

    let lastIndex = notebook.activeCellIndex;
    const selected = notebook.widgets.filter((child, index) => {
      const active = notebook.isSelectedOrActive(child);

      if (active) {
        lastIndex = index;
      }

      return active;
    });

    notebook.activeCellIndex = lastIndex;
    notebook.deselectAll();

    return Promise.all(
      selected.map(child =>
        runCell(notebook, child, sessionContext, sessionDialogs, translator)
      )
    )
      .then(results => {
        if (notebook.isDisposed) {
          return false;
        }
        selectionExecuted.emit({
          notebook,
          lastCell: notebook.widgets[lastIndex]
        });
        // Post an update request.
        notebook.update();

        return results.every(result => result);
      })
      .catch(reason => {
        if (reason.message.startsWith('KernelReplyNotOK')) {
          selected.map(cell => {
            // Remove '*' prompt from cells that didn't execute
            if (
              cell.model.type === 'code' &&
              (cell as CodeCell).model.executionCount == null
            ) {
              cell.setPrompt('');
            }
          });
        } else {
          throw reason;
        }

        selectionExecuted.emit({
          notebook,
          lastCell: notebook.widgets[lastIndex]
        });

        notebook.update();

        return false;
      });
  }


  /**
   * Run a cell.
   */
  async function runCell(
    notebook: Notebook,
    cell: Cell,
    sessionContext?: ISessionContext,
    sessionDialogs?: ISessionContextDialogs,
    translator?: ITranslator
  ): Promise<boolean> {
    translator = translator || nullTranslator;
    const trans = translator.load('jupyterlab');
    switch (cell.model.type) {
      case 'markdown':
        (cell as MarkdownCell).rendered = true;
        cell.inputHidden = false;
        executed.emit({ notebook, cell, success: true });
        break;
      case 'code':
        if (sessionContext) {
          if (sessionContext.isTerminating) {
            await showDialog({
              title: trans.__('Kernel Terminating'),
              body: trans.__(
                'The kernel for %1 appears to be terminating. You can not run any cell for now.',
                sessionContext.session?.path
              ),
              buttons: [Dialog.okButton()]
            });
            break;
          }
          if (sessionContext.pendingInput) {
            await showDialog({
              title: trans.__('Cell not executed due to pending input'),
              body: trans.__(
                'The cell has not been executed to avoid kernel deadlock as there is another pending input! Submit your pending input and try again.'
              ),
              buttons: [Dialog.okButton()]
            });
            return false;
          }
          if (sessionContext.hasNoKernel) {
            const shouldSelect = await sessionContext.startKernel();
            if (shouldSelect && sessionDialogs) {
              await sessionDialogs.selectKernel(sessionContext);
            }
          }

          if (sessionContext.hasNoKernel) {
            cell.model.sharedModel.transact(() => {
              (cell.model as ICodeCellModel).clearExecution();
            });
            return true;
          }

          const deletedCells = notebook.model?.deletedCells ?? [];

          // !!! DATAFLOW NOTEBOOK SPECIFIC CODE !!!
          const codeDict: { [key: string]: string } = {};
          const cellIdWidgetMap: { [key: string]: any } = {};
          const outputTags: { [key: string]: string[] } = {};
          const inputTags: { [key: string]: string } = {};
	        if (notebook.model) {
            for (let index = 0; index < notebook.model.cells.length; index++) {
              const c = notebook.model.cells.get(index);
              const child = notebook.widgets[index] as DataflowCodeCell;
              if (c.type === 'code') {
                // FIXME replace with utility function (see dfcells/widget)
                const cId = c.id.replace(/-/g, '').substring(0, 8);
                const inputTag = c.getMetadata('tag');
                if (inputTag) {
                  // FIXME need to check for duplicates!
                  inputTags[inputTag as string] = cId;
                }
                codeDict[cId] = c.sharedModel.getSource();
                cellIdWidgetMap[cId] = child;
                let cellOutputTags: string[] = [];
                for (let i = 0; i < child.outputArea.model.length; ++i) {
                  const out = child.outputArea.model.get(i);
                  if (out.metadata['output_tag']) {
                    cellOutputTags.push(out.metadata['output_tag'] as string);
                  }
                }
                outputTags[cId] = cellOutputTags;
              }
            };
          }
          // console.log('codeDict:', codeDict);
          // console.log('cellIdWidgetMap:', cellIdWidgetMap);
          // console.log('outputTags:', outputTags);
          // console.log('inputTags:', inputTags);

          const dfData = {
            // FIXME replace with utility function (see dfcells/widget)
            uuid: cell.model.id.replace(/-/g, '').substring(0, 8) || '',
            code_dict: codeDict,
            output_tags: outputTags, // this.notebook.get_output_tags(Object.keys(code_dict)),
            input_tags: inputTags,
            auto_update_flags: {}, // this.notebook.get_auto_update_flags(),
            force_cached_flags: {} // this.notebook.get_force_cached_flags()})
          };
          // !!! END DATAFLOW NOTEBOOK SPECIFIC CODE !!!
          executionScheduled.emit({ notebook, cell });

          let ran = false;
          try {

            // !!! DATAFLOW NOTEBOOK CODE !!!
            const reply = await DataflowCodeCell.execute(
              cell as DataflowCodeCell,
              sessionContext,
              {
                deletedCells,
                recordTiming: notebook.notebookConfig.recordTiming
              },
              dfData,
              cellIdWidgetMap,
            );
            // !!! END DATAFLOW NOTEBOOK CODE !!!
            deletedCells.splice(0, deletedCells.length);

            ran = (() => {
              if (cell.isDisposed) {
                return false;
              }

              if (!reply) {
                return true;
              }
              if (reply.content.status === 'ok') {
                const content = reply.content;

                if (content.payload && content.payload.length) {
                  handlePayload(content, notebook, cell);
                }

                return true;
              } else {
                throw new KernelError(reply.content);
              }
            })();
          } catch (reason) {
            if (cell.isDisposed || reason.message.startsWith('Canceled')) {
              ran = false;
            } else {
              executed.emit({
                notebook,
                cell,
                success: false,
                error: reason
              });
              throw reason;
            }
          }

          if (ran) {
            executed.emit({ notebook, cell, success: true });
          }

          return ran;
        }
        cell.model.sharedModel.transact(() => {
          (cell.model as ICodeCellModel).clearExecution();
        }, false);
        break;
      default:
        break;
    }

    return Promise.resolve(true);
  }

  /**
   * Handle payloads from an execute reply.
   *
   * #### Notes
   * Payloads are deprecated and there are no official interfaces for them in
   * the kernel type definitions.
   * See [Payloads (DEPRECATED)](https://jupyter-client.readthedocs.io/en/latest/messaging.html#payloads-deprecated).
   */
  function handlePayload(
    content: KernelMessage.IExecuteReply,
    notebook: Notebook,
    cell: Cell
  ) {
    const setNextInput = content.payload?.filter(i => {
      return (i as any).source === 'set_next_input';
    })[0];

    if (!setNextInput) {
      return;
    }

    const text = setNextInput.text as string;
    const replace = setNextInput.replace;

    if (replace) {
      cell.model.sharedModel.setSource(text);
      return;
    }

    // Create a new code cell and add as the next cell.
    const notebookModel = notebook.model!.sharedModel;
    const cells = notebook.model!.cells;
    const index = findIndex(cells, model => model === cell.model);

    // While this cell has no outputs and could be trusted following the letter
    // of Jupyter trust model, its content comes from kernel and hence is not
    // necessarily controlled by the user; if we set it as trusted, a user
    // executing cells in succession could end up with unwanted trusted output.
    if (index === -1) {
      notebookModel.insertCell(notebookModel.cells.length, {
        cell_type: 'code',
        source: text,
        metadata: {
          trusted: false
        }
      });
    } else {
      notebookModel.insertCell(index + 1, {
        cell_type: 'code',
        source: text,
        metadata: {
          trusted: false
        }
      });
    }
  }

  /**
   * Get the selected cell(s) without affecting the clipboard.
   *
   * @param notebook - The target notebook widget.
   *
   * @returns A list of 0 or more selected cells
   */
  export function selectedCells(notebook: Notebook): nbformat.ICell[] {
    return notebook.widgets
      .filter(cell => notebook.isSelectedOrActive(cell))
      .map(cell => cell.model.toJSON())
      .map(cellJSON => {
        if ((cellJSON.metadata as JSONObject).deletable !== undefined) {
          delete (cellJSON.metadata as JSONObject).deletable;
        }
        return cellJSON;
      });
  }
}
