import { Token } from '@lumino/coreutils';
import { DataflowNotebookWidgetFactory } from './widgetfactory';

/**
 * The dfnotebook widget factory token.
 */
export const IDataflowNotebookWidgetFactory = new Token<DataflowNotebookWidgetFactory.IFactory>(
    '@dfnotebook/dfnotebook:DataflowNotebookWidgetFactory',
    'A service to create the dataflow notebook viewer.'
);