import { Token } from '@lumino/coreutils';
import { DataflowNotebookModelFactory } from './modelfactory';
import { DataflowNotebookPanel } from './panel';
import { DataflowNotebookWidgetFactory } from './widgetfactory';

/* tslint:disable */
/**
 * The dfnotebook model factory token.
 */
export const IDataflowNotebookModelFactory = new Token<DataflowNotebookModelFactory.IFactory>(
    '@dfnotebook/dfnotebook:IDataflowNotebookModelFactory'
);
/* tslint:enable */

/* tslint:disable */
/**
 * The dfnotebook widget factory token.
 */
export const IDataflowNotebookWidgetFactory = new Token<DataflowNotebookWidgetFactory.IFactory>(
    '@dfnotebook/dfnotebook:DataflowNotebookWidgetFactory'
);
/* tslint:enable */

/* tslint:disable */
/**
 * The dfnotebook content factory token.
 */
export const IDataflowNotebookContentFactory = new Token<DataflowNotebookPanel.IContentFactory>(
    '@dfnotebook/dfnotebook:IDataflowNotebookContentFactory'
);
/* tslint:enable */