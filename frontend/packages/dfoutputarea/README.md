# @dfnotebook/dfoutputarea

A JupyterLab package which provides a modified implementation of [@jupyterlab/outputarea](https://github.com/jupyterlab/jupyterlab/tree/master/packages/outputarea), the Jupyter notebook output area.
Execution results from the [@dfnotebook/dfnotebook](../dfnotebook) are placed in the output area.

Output areas are able to render results of several different mime types, which are implemented
in the [@jupyterlab/rendermime](https://github.com/jupyterlab/jupyterlab/tree/master/packages/rendermime) package. This list of mime types may be extended via the simplified mime-extension interface defined in [@jupyterlab/rendermime-interfaces](https://github.com/jupyterlab/jupyterlab/tree/master/packages/rendermime-interfaces).
