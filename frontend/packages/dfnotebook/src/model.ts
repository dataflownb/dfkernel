// Copyright (c) Jupyter Development Team.
// Distributed under the terms of the Modified BSD License.

import { NotebookModel } from '@jupyterlab/notebook';
import * as nbformat from '@jupyterlab/nbformat';


export class DataflowNotebookModel extends NotebookModel {

  fromJSON(value: nbformat.INotebookContent): void {
    let isDataflow = true;
    if (value.metadata?.kernelspec?.name && value.metadata.kernelspec.name != 'dfpython3') {
      isDataflow = false;
    }
    super.fromJSON(value);
    this.setMetadata('dfnotebook', isDataflow);
  }

}
