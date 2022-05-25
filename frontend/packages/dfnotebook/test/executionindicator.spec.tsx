// Copyright (c) Jupyter Development Team.
// Distributed under the terms of the Modified BSD License.

import { ISessionContext, SessionContext } from '@jupyterlab/apputils';
import { IRenderMimeRegistry } from '@jupyterlab/rendermime';
import { createSessionContext } from '@jupyterlab/testutils';
import { JupyterServer } from '@jupyterlab/testutils/lib/start_jupyter_server';
import {
  ExecutionIndicator,
  ExecutionIndicatorComponent,
  Notebook,
  NotebookActions,
  NotebookModel
} from '..';
import * as utils from './utils';
import React from 'react';
import ReactDOMServer from 'react-dom/server';

const fastCellModel = {
  cell_type: 'code',
  execution_count: 1,
  metadata: { tags: [] },
  outputs: [],
  source: ['print("hello")\n']
};

const slowCellModel = {
  cell_type: 'code',
  execution_count: 1,
  metadata: { tags: [] },
  outputs: [],
  source: ['import time\n', 'time.sleep(3)\n']
};

const server = new JupyterServer();

beforeAll(async () => {
  jest.setTimeout(20000);
  await server.start();
});

afterAll(async () => {
  await server.shutdown();
});

describe('@jupyterlab/notebook', () => {
  let rendermime: IRenderMimeRegistry;

  describe('ExecutionIndicator', () => {
    let widget: Notebook;
    let sessionContext: ISessionContext;
    let ipySessionContext: ISessionContext;
    let indicator: ExecutionIndicator;
    beforeAll(async function () {
      jest.setTimeout(20000);
      rendermime = utils.defaultRenderMime();

      async function createContext(options?: Partial<SessionContext.IOptions>) {
        const context = await createSessionContext(options);
        await context.initialize();
        await context.session?.kernel?.info;
        return context;
      }
      [sessionContext, ipySessionContext] = await Promise.all([
        createContext(),
        createContext({ kernelPreference: { name: 'ipython' } })
      ]);
    });

    beforeEach(async () => {
      widget = new Notebook({
        rendermime,
        contentFactory: utils.createNotebookFactory(),
        mimeTypeService: utils.mimeTypeService
      });
      const model = new NotebookModel();
      const modelJson = {
        ...utils.DEFAULT_CONTENT,
        cells: [fastCellModel, slowCellModel, slowCellModel, fastCellModel]
      };

      model.fromJSON(modelJson);

      widget.model = model;
      model.sharedModel.clearUndoHistory();

      widget.activeCellIndex = 0;
      for (let idx = 0; idx < widget.widgets.length; idx++) {
        widget.select(widget.widgets[idx]);
      }
      indicator = new ExecutionIndicator();
      indicator.model.attachNotebook({
        content: widget,
        context: ipySessionContext
      });
      await ipySessionContext.restartKernel();
    });

    afterEach(() => {
      widget.dispose();
      utils.clipboard.clear();
      indicator.dispose();
    });

    afterAll(async () => {
      await Promise.all([
        sessionContext.shutdown(),
        ipySessionContext.shutdown()
      ]);
    });

    describe('executedAllCell', () => {
      it('should count correctly number of scheduled cell', async () => {
        let scheduledCell: number | undefined = 0;

        indicator.model.stateChanged.connect(state => {
          scheduledCell = state.executionState(widget)!.scheduledCellNumber;
        });

        await NotebookActions.run(widget, ipySessionContext);
        expect(scheduledCell).toBe(4);
      });

      it('should count correctly elapsed time', async () => {
        let elapsedTime: number | undefined = 0;

        indicator.model.stateChanged.connect(state => {
          elapsedTime = state.executionState(widget)!.totalTime;
        });

        await NotebookActions.run(widget, ipySessionContext);
        expect(elapsedTime).toBeGreaterThanOrEqual(6);
      });

      it('should tick every second', async () => {
        let tick: Array<number> = [];

        indicator.model.stateChanged.connect(state => {
          tick.push(state.executionState(widget)!.totalTime);
        });

        await NotebookActions.run(widget, ipySessionContext);
        expect(tick).toEqual(expect.arrayContaining([1, 2, 3, 4, 5, 6, 6]));
      });

      it('should count correctly number of executed requests', async () => {
        let executed: Array<number> = [];

        indicator.model.stateChanged.connect(state => {
          executed.push(state.executionState(widget)!.scheduledCell.size);
        });

        await NotebookActions.run(widget, ipySessionContext);
        expect(executed).toEqual(expect.arrayContaining([3, 3, 3, 2, 2, 2, 0]));
      });
    });
  });
  describe('testProgressCircle', () => {
    let displayOption: { showOnToolBar: boolean; showProgress: boolean };
    let defaultState: {
      interval: number;
      kernelStatus: ISessionContext.KernelDisplayStatus;
      executionStatus: string;
      needReset: boolean;
      scheduledCell: Set<string>;
      scheduledCellNumber: number;
      timeout: number;
      totalTime: number;
    };

    const EMPTY_CIRCLE = 'M 0 0 v -104 A 104 104 1 0 0 -0.0000 -104.0000 z';
    const HALF_FILLED_CIRCLE = 'M 0 0 v -104 A 104 104 1 0 0 0.0000 104.0000 z';
    const FILLED_CIRCLE = 'M 0 0 v -104 A 104 104 1 1 0 0.1815 -103.9998 z';

    beforeEach(() => {
      displayOption = { showOnToolBar: false, showProgress: true };
      defaultState = {
        interval: 0,
        kernelStatus: 'idle',
        executionStatus: 'idle',
        needReset: false,
        scheduledCell: new Set<string>(),
        scheduledCellNumber: 0,
        timeout: 0,
        totalTime: 0
      };
    });
    it('Should render an empty div with undefined state', () => {
      const element = (
        <ExecutionIndicatorComponent
          displayOption={displayOption}
          state={undefined}
          translator={undefined}
        />
      );
      const htmlElement = ReactDOMServer.renderToString(element);
      expect(htmlElement).toContain('<div data-reactroot=""></div>');
    });
    it('Should render a filled circle with 0/2 cell executed message', () => {
      defaultState.scheduledCellNumber = 2;
      defaultState.scheduledCell.add('foo');
      defaultState.scheduledCell.add('bar');
      defaultState.executionStatus = 'busy';
      defaultState.totalTime = 1;
      const element = (
        <ExecutionIndicatorComponent
          displayOption={displayOption}
          state={defaultState}
          translator={undefined}
        />
      );
      const htmlElement = ReactDOMServer.renderToString(element);
      expect(htmlElement).toContain(FILLED_CIRCLE);
      expect(htmlElement).toContain(`Executed 0/2 requests`);
    });

    it('Should render a half filled circle with 1/2 cell executed message', () => {
      defaultState.scheduledCellNumber = 2;
      defaultState.scheduledCell.add('foo');
      defaultState.executionStatus = 'busy';
      defaultState.totalTime = 1;
      const element = (
        <ExecutionIndicatorComponent
          displayOption={displayOption}
          state={defaultState}
          translator={undefined}
        />
      );
      const htmlElement = ReactDOMServer.renderToString(element);
      expect(htmlElement).toContain(HALF_FILLED_CIRCLE);
      expect(htmlElement).toContain(`Executed 1/2 requests`);
    });

    it('Should render an empty circle with 2 requests executed message', () => {
      defaultState.scheduledCellNumber = 2;
      defaultState.executionStatus = 'idle';
      defaultState.totalTime = 1;
      const element = (
        <ExecutionIndicatorComponent
          displayOption={displayOption}
          state={defaultState}
          translator={undefined}
        />
      );
      const htmlElement = ReactDOMServer.renderToString(element);
      expect(htmlElement).toContain(EMPTY_CIRCLE);
      expect(htmlElement).toContain(`Executed 2 requests`);
    });
  });
});
