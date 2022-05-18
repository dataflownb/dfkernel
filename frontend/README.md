# Dataflow Notebook Extension for Jupyter/Python

[![License](https://img.shields.io/badge/License-BSD3-blue.svg)](https://github.com/dataflownb/dfnotebook-extension/blob/master/LICENSE)

This package is part of the [Dataflow Notebooks](https://dataflownb.github.io) project and provides the Dataflow Notebook interface for JupyterLab, and is intended to be used with the [dfkernel](https://github.com/dataflownb/dfkernel) kernel.
Dataflow notebooks seek to elevate *outputs* as memorable waypoints during exploratory computation. To that end,

- Cell identifiers are **persistent** across sessions and are random UUIDs to signal they do not depend on top-down order.
- As with standard IPython, outputs are designated by being written as expressions or assignments on the **last line** of a cell.
- Each output is identified by its variable name if one is specified (e.g. `a`, `c,d = 4,5`), and the cell identifier if not (e.g. `4 + c`)
- Variable names **can be reused** across cells.
- Cells are executed as closures so only the outputs are accessible from other cells.
- An output can then be referenced in three ways:
    1. unscoped: `foo` refers to the most recent execution output named `foo`
    2. persistent: `foo$ba012345` refers to output `foo` from cell `ba012345`
    3. tagged: `foo$bar` refers to output `foo` from the cell tagged as `bar`
- All output references are transformed to **persistent** names upon execution.
- Output references implicitly define a dataflow in a directed acyclic graph, and the kernel automatically executes dependencies.

## Example Notebook

<img src="https://dataflownb.github.io/assets/images/dfnotebook.svg" width="640" alt="Dataflow Notebook Example">

## Requirements

* JupyterLab >= 2.0

## Install

This extension uses a Jupyter kernel named [`dfkernel`](https://github.com/dataflownb/dfkernel) 
for the backend and a NPM package named `dfnotebook-extension`
for the frontend extension.

Note: You will need NodeJS to install the extension. (If using conda, this can be done via `conda install nodejs`.)

```bash
pip install dfkernel
jupyter labextension uninstall @jupyterlab/notebook-extension --no-build
jupyter labextension install @dfnotebook/dfnotebook-extension
jupyter lab build
```

## Troubleshooting

If you are not seeing the frontend, check the frontend is installed:

```bash
jupyter labextension list
```

If it is installed, try:

```bash
jupyter lab clean
jupyter lab build
```

## Contributing

### Install

The `jlpm` command is JupyterLab's pinned version of
[yarn](https://yarnpkg.com/) that is installed with JupyterLab. You may use
`yarn` or `npm` in lieu of `jlpm` below.

```bash
# Clone the [dfkernel](https://github.com/dataflownb/dfkernel) repo to your local environment
# Move to dfkernel directory

pip install -e .

# Clone the dfnotebook-extension repo to your local environment
# Move to dfnotebook-extension directory

# Install dependencies
jlpm
# Build Typescript source
jlpm build
# uninstall the standard notebook-extension
jupyter labextension uninstall @jupyterlab/notebook-extension --no-build
# Link your development version of the extension with JupyterLab
jupyter labextension link dfoutputarea --no-build
jupyter labextension link dfcells --no-build
jupyter labextension link dfnotebook --no-build
jupyter labextension install dfnotebook-extension
# Rebuild Typescript source after making changes
jlpm build
# Rebuild JupyterLab after making any changes
jupyter lab build
```

You can watch the source directory and run JupyterLab in watch mode to watch for changes in the extension's source and automatically rebuild the extension and application.

```bash
# Watch the source directory in another terminal tab
jlpm watch
# Run jupyterlab in watch mode in one terminal tab
jupyter lab --watch
```

Now every change will be built locally and bundled into JupyterLab. Be sure to refresh your browser page after saving file changes to reload the extension (note: you'll need to wait for webpack to finish, which can take 10s+ at times).

### Uninstall

```bash
jupyter labextension uninstall @dfnotebook/dfnotebook-extension --no-build
jupyter labextension install @jupyterlab/notebook-extension
pip uninstall dfkernel
```
