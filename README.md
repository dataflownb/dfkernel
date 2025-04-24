# Dataflow Notebook for Jupyter/Python

[![License](https://img.shields.io/badge/License-BSD3-blue.svg)](https://github.com/dataflownb/dfkernel/blob/master/LICENSE)
[![PyPI version](https://badge.fury.io/py/dfnotebook.svg)](https://badge.fury.io/py/dfnotebook)
<!--
[![Build Status](https://travis-ci.org/dataflownb/dfkernel.svg?branch=master)](https://travis-ci.org/dataflownb/dfkernel)
[![Documentation Status](https://readthedocs.org/projects/dfkernel/badge)](http://dfkernel.readthedocs.io/)
[![Binder](https://mybinder.org/badge.svg)](https://mybinder.org/v2/gh/dataflownb/dfexamples/master)
-->

This package provides the Dataflow Notebook interface and kernel for JupyterLab.
Dataflow notebooks seek to elevate _outputs_ as memorable waypoints during exploratory computation. To that end,

- Cell identifiers are **persistent** across sessions and are random UUIDs to signal they do not depend on top-down order.
- As with standard IPython, outputs are designated by being written as expressions or assignments on the **last line** of a cell.
- Each output is identified by its variable name if one is specified (e.g. `a`, `c,d = 4,5`), and the cell identifier if not (e.g. `4 + c`)
- Variable names **can be reused** across cells.
- Cells are executed as closures so only the outputs are accessible from other cells.
- An output can then be referenced in three ways:
  1. unscoped: `foo` refers to the most recent execution output named `foo`
  2. persistent: `foo$ba012345` refers to output `foo` from cell `ba012345`
  3. tagged: `foo$bar` refers to output `foo` from the cell tagged as `bar`
- All output references are transformed to **persistent** names upon execution. However, these references are only shown when the reference may be ambiguous (i.e. when the notebook has two cells each with an output with the same name).
- Output references implicitly define a dataflow in a directed acyclic graph, and the kernel automatically executes dependencies.

## Example Notebook

<img src="https://dataflownb.github.io/assets/images/dfnotebook.svg" width="640" alt="Dataflow Notebook Example">

## Install

To install the extension and bundled kernel, execute:

```bash
pip install dfnotebook
```

## Requirements

- JupyterLab >= 4.0.0
- IPython >= 8.0
- ipykernel >= 6.0

## Uninstall

To remove the extension, execute:

```bash
pip uninstall dfnotebook
```

## Contributing

### Development install

Note: You will need NodeJS to build the extension package.

The `jlpm` command is JupyterLab's pinned version of
[yarn](https://yarnpkg.com/) that is installed with JupyterLab. You may use
`yarn` or `npm` in lieu of `jlpm` below.

```bash
# Clone the repo to your local environment
# Change directory to the dfnotebook directory
# Install package in development mode
pip install -e "."
# Link your development version of the extension with JupyterLab
jupyter labextension develop . --overwrite
# Rebuild extension Typescript source after making changes
jlpm build
```

You can watch the source directory and run JupyterLab at the same time in different terminals to watch for changes in the extension's source and automatically rebuild the extension.

```bash
# Watch the source directory in one terminal, automatically rebuilding when needed
jlpm watch
# Run JupyterLab in another terminal
jupyter lab
```

With the watch command running, every saved change will immediately be built locally and available in your running JupyterLab. Refresh JupyterLab to load the change in your browser (you may need to wait several seconds for the extension to be rebuilt).

By default, the `jlpm build` command generates the source maps for this extension to make it easier to debug using the browser dev tools. To also generate source maps for the JupyterLab core extensions, you can run the following command:

```bash
jupyter lab build --minimize=False
```

### Development uninstall

```bash
pip uninstall dfnotebook
```

In development mode, you will also need to remove the symlink created by `jupyter labextension develop`
command. To find its location, you can run `jupyter labextension list` to figure out where the `labextensions`
folder is located. Then you can remove the symlink named `@dfnotebook/dfnotebook-extension` within that folder.

### Testing the extension

#### Frontend tests

This extension is using [Jest](https://jestjs.io/) for JavaScript code testing.

To execute them, execute:

```sh
jlpm
jlpm test
```

#### Integration tests

This extension uses [Playwright](https://playwright.dev/docs/intro) for the integration tests (aka user level tests).
More precisely, the JupyterLab helper [Galata](https://github.com/jupyterlab/jupyterlab/tree/master/galata) is used to handle testing the extension in JupyterLab.

More information are provided within the [ui-tests](./ui-tests/README.md) README.

### Packaging the extension

See [RELEASE](RELEASE.md)

## Previous Versions

The dataflow notebook was originally released as dfkernel and worked with older versions of Jupyter Notebook. It was updated to support JupyterLab as a paired set of packages (dfkernel and dfnotebook(-extension)). More recently, these were unified into a single package (dfnotebook).