// Copyright (c) Jupyter Development Team.
// Distributed under the terms of the Modified BSD License.

import {
  Dialog,
  ISessionContext,
  sessionContextDialogs,
  showDialog
} from '@jupyterlab/apputils';

import * as nbformat from '@jupyterlab/nbformat';
import { KernelMessage } from '@jupyterlab/services';
import { ITranslator, nullTranslator } from '@jupyterlab/translation';
import { ArrayExt, each, toArray } from '@lumino/algorithm';
import { JSONObject } from '@lumino/coreutils';
import { ElementExt } from '@lumino/domutils';
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
   *
   * @param sessionContext - The optional client session object.
   *
   * #### Notes
   * The last selected cell will be activated, but not scrolled into view.
   * The existing selection will be cleared.
   * An execution error will prevent the remaining code cells from executing.
   * All markdown cells will be rendered.
   */
  export function run(
    notebook: Notebook,
    sessionContext?: ISessionContext
  ): Promise<boolean> {
    if (!notebook.model || !notebook.activeCell) {
      return Promise.resolve(false);
    }

    const state = Private.getState(notebook);
    const promise = Private.runSelected(notebook, sessionContext);

    Private.handleRunState(notebook, state, false);
    return promise;
  }

  /**
   * Run the selected cell(s) and advance to the next cell.
   *
   * @param notebook - The target notebook widget.
   *
   * @param sessionContext - The optional client session object.
   *
   * #### Notes
   * The existing selection will be cleared.
   * The cell after the last selected cell will be activated and scrolled into view.
   * An execution error will prevent the remaining code cells from executing.
   * All markdown cells will be rendered.
   * If the last selected cell is the last cell, a new code cell
   * will be created in `'edit'` mode.  The new cell creation can be undone.
   */
  export function runAndAdvance(
    notebook: Notebook,
    sessionContext?: ISessionContext
  ): Promise<boolean> {
    if (!notebook.model || !notebook.activeCell) {
      return Promise.resolve(false);
    }

    const state = Private.getState(notebook);
    const promise = Private.runSelected(notebook, sessionContext);
    const model = notebook.model;

    if (notebook.activeCellIndex === notebook.widgets.length - 1) {
      const cell = model.contentFactory.createCell(
        notebook.notebookConfig.defaultCell,
        {}
      );

      // Do not use push here, as we want an widget insertion
      // to make sure no placeholder widget is rendered.
      model.cells.insert(notebook.widgets.length, cell);
      notebook.activeCellIndex++;
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
   *
   * @param sessionContext - The optional client session object.
   *
   * #### Notes
   * An execution error will prevent the remaining code cells from executing.
   * All markdown cells will be rendered.
   * The widget mode will be set to `'edit'` after running.
   * The existing selection will be cleared.
   * The cell insert can be undone.
   * The new cell will be scrolled into view.
   */
  export function runAndInsert(
    notebook: Notebook,
    sessionContext?: ISessionContext
  ): Promise<boolean> {
    if (!notebook.model || !notebook.activeCell) {
      return Promise.resolve(false);
    }

    if (!Private.isNotebookRendered(notebook)) {
      return Promise.resolve(false);
    }
    const state = Private.getState(notebook);
    const promise = Private.runSelected(notebook, sessionContext);
    const model = notebook.model;
    const cell = model.contentFactory.createCell(
      notebook.notebookConfig.defaultCell,
      {}
    );

    model.cells.insert(notebook.activeCellIndex + 1, cell);
    notebook.activeCellIndex++;
    notebook.mode = 'edit';
    Private.handleRunState(notebook, state, true);
    return promise;
  }

  /**
   * Run all of the cells in the notebook.
   *
   * @param notebook - The target notebook widget.
   *
   * @param sessionContext - The optional client session object.
   *
   * #### Notes
   * The existing selection will be cleared.
   * An execution error will prevent the remaining code cells from executing.
   * All markdown cells will be rendered.
   * The last cell in the notebook will be activated and scrolled into view.
   */
  export function runAll(
    notebook: Notebook,
    sessionContext?: ISessionContext
  ): Promise<boolean> {
    if (!notebook.model || !notebook.activeCell) {
      return Promise.resolve(false);
    }

    const state = Private.getState(notebook);

    notebook.widgets.forEach(child => {
      notebook.select(child);
    });

    const promise = Private.runSelected(notebook, sessionContext);

    Private.handleRunState(notebook, state, true);
    return promise;
  }

  export function renderAllMarkdown(
    notebook: Notebook,
    sessionContext?: ISessionContext
  ): Promise<boolean> {
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
    const promise = Private.runSelected(notebook, sessionContext);
    notebook.activeCellIndex = previousIndex;
    Private.handleRunState(notebook, state, true);
    return promise;
  }

  /**
   * Run all of the cells before the currently active cell (exclusive).
   *
   * @param notebook - The target notebook widget.
   *
   * @param sessionContext - The optional client session object.
   *
   * #### Notes
   * The existing selection will be cleared.
   * An execution error will prevent the remaining code cells from executing.
   * All markdown cells will be rendered.
   * The currently active cell will remain selected.
   */
  export function runAllAbove(
    notebook: Notebook,
    sessionContext?: ISessionContext
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

    const promise = Private.runSelected(notebook, sessionContext);

    notebook.activeCellIndex++;
    Private.handleRunState(notebook, state, true);
    return promise;
  }

  /**
   * Run all of the cells after the currently active cell (inclusive).
   *
   * @param notebook - The target notebook widget.
   *
   * @param sessionContext - The optional client session object.
   *
   * #### Notes
   * The existing selection will be cleared.
   * An execution error will prevent the remaining code cells from executing.
   * All markdown cells will be rendered.
   * The last cell in the notebook will be activated and scrolled into view.
   */
  export function runAllBelow(
    notebook: Notebook,
    sessionContext?: ISessionContext
  ): Promise<boolean> {
    if (!notebook.model || !notebook.activeCell) {
      return Promise.resolve(false);
    }

    const state = Private.getState(notebook);

    notebook.deselectAll();
    for (let i = notebook.activeCellIndex; i < notebook.widgets.length; ++i) {
      notebook.select(notebook.widgets[i]);
    }

    const promise = Private.runSelected(notebook, sessionContext);

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
     * The active cell before the action.
     */
    activeCell: Cell | null;
  }

  export function isNotebookRendered(notebook: Notebook): boolean {
    const translator = notebook.translator;
    const trans = translator.load('jupyterlab');

    if (notebook.remainingCellToRenderCount !== 0) {
      showDialog({
        body: trans.__(
          `Notebook is still rendering and has for now (%1) remaining cells to render.

Please wait for the complete rendering before invoking that action.`,
          notebook.remainingCellToRenderCount
        ),
        buttons: [Dialog.okButton({ label: trans.__('Ok') })]
      }).catch(reason => {
        console.error(
          'An error occurred when displaying notebook rendering warning',
          reason
        );
      });
      return false;
    }
    return true;
  }

  /**
   * Get the state of a widget before running an action.
   */
  export function getState(notebook: Notebook): IState {
    return {
      wasFocused: notebook.node.contains(document.activeElement),
      activeCell: notebook.activeCell
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
    const { activeCell, node } = notebook;

    if (state.wasFocused || notebook.mode === 'edit') {
      notebook.activate();
    }

    if (scrollIfNeeded && activeCell) {
      ElementExt.scrollIntoViewIfNeeded(node, activeCell.node);
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
    if (scroll && state.activeCell) {
      // Scroll to the top of the previous active cell output.
      const rect = state.activeCell.inputArea.node.getBoundingClientRect();

      notebook.scrollToPosition(rect.bottom, 45);
    }
  }

  /**
   * Run the selected cells.
   */
  export function runSelected(
    notebook: Notebook,
    sessionContext?: ISessionContext
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
      selected.map(child => runCell(notebook, child, sessionContext))
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
  function runCell(
    notebook: Notebook,
    cell: Cell,
    sessionContext?: ISessionContext,
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
            void showDialog({
              title: trans.__('Kernel Terminating'),
              body: trans.__(
                'The kernel for %1 appears to be terminating. You can not run any cell for now.',
                sessionContext.session?.path
              ),
              buttons: [Dialog.okButton({ label: trans.__('Ok') })]
            });
            break;
          }
          if (sessionContext.pendingInput) {
            void showDialog({
              title: trans.__('Cell not executed due to pending input'),
              body: trans.__(
                'The cell has not been executed to avoid kernel deadlock as there is another pending input! Submit your pending input and try again.'
              ),
              buttons: [Dialog.okButton({ label: trans.__('Ok') })]
            });
            return Promise.resolve(false);
          }
          if (sessionContext.hasNoKernel) {
            void sessionContextDialogs.selectKernel(sessionContext);
            return Promise.resolve(false);
          }
          const deletedCells = notebook.model?.deletedCells ?? [];
          const codeDict: { [key: string]: string } = {};
          const cellIdWidgetMap: { [key: string]: any } = {};
          const outputTags: { [key: string]: string[] } = {};
          const inputTags: { [key: string]: string } = {};
	        if (notebook.model) {
            each(notebook.model.cells, (c: ICodeCellModel, index) => {
              const child = notebook.widgets[index] as DataflowCodeCell;
              if (c.type === 'code') {
                // FIXME replace with utility function (see dfcells/widget)
                const cId = c.id.replace(/-/g, '').substring(0, 8);
                const inputTag = c.metadata.get('tag');
                if (inputTag) {
                  // FIXME need to check for duplicates!
                  inputTags[inputTag as string] = cId;
                }
                codeDict[cId] = c.value.text;
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
            });
          }
          console.log('codeDict:', codeDict);
          console.log('cellIdWidgetMap:', cellIdWidgetMap);
          console.log('outputTags:', outputTags);
          console.log('inputTags:', inputTags);

          const dfData = {
            // FIXME replace with utility function (see dfcells/widget)
            uuid: cell.model.id.replace(/-/g, '').substring(0, 8) || '',
            code_dict: codeDict,
            output_tags: outputTags, // this.notebook.get_output_tags(Object.keys(code_dict)),
            input_tags: inputTags,
            auto_update_flags: {}, // this.notebook.get_auto_update_flags(),
            force_cached_flags: {} // this.notebook.get_force_cached_flags()})
          };
          executionScheduled.emit({ notebook, cell });
          return DataflowCodeCell.execute(cell as DataflowCodeCell, sessionContext, {
            deletedCells,
            recordTiming: notebook.notebookConfig.recordTiming,
          },
              dfData,
              cellIdWidgetMap,
              )
            .then(reply => {
              deletedCells.splice(0, deletedCells.length);
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
            })
            .catch(reason => {
              if (cell.isDisposed || reason.message.startsWith('Canceled')) {
                return false;
              }
              executed.emit({ notebook, cell, success: false, error: reason });
              throw reason;
            })
            .then(ran => {
              if (ran) {
                executed.emit({ notebook, cell, success: true });
              }

              return ran;
            });
        }
        (cell.model as ICodeCellModel).clearExecution();
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
      cell.model.value.text = text;
      return;
    }

    // Create a new code cell and add as the next cell.
    const newCell = notebook.model!.contentFactory.createCodeCell({});
    const cells = notebook.model!.cells;
    const index = ArrayExt.firstIndexOf(toArray(cells), cell.model);

    newCell.value.text = text;
    if (index === -1) {
      cells.push(newCell);
    } else {
      cells.insert(index + 1, newCell);
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
