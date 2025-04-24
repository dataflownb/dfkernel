# Dataflow Notebook for Jupyter/Python

[![License](https://img.shields.io/badge/License-BSD3-blue.svg)](https://github.com/dataflownb/dfnotebook/blob/master/LICENSE)
[![PyPI version](https://badge.fury.io/py/dfnotebook.svg)](https://badge.fury.io/py/dfnotebook)
<!--
[![Build Status](https://travis-ci.org/dataflownb/dfkernel.svg?branch=master)](https://travis-ci.org/dataflownb/dfkernel)
[![Documentation Status](https://readthedocs.org/projects/dfkernel/badge)](http://dfkernel.readthedocs.io/)
[![Binder](https://mybinder.org/badge.svg)](https://mybinder.org/v2/gh/dataflownb/dfexamples/master)
-->

Dataflow notebooks are Jupyter notebooks written in Python that elevate outputs to link cells. Outputs of cells are labeled by their identifiers. Referencing an output of one cell in another cell creates a dependency between between the two cells, allowing the system to ensure upstream cells are up-to-date before executing a cell. Dataflow notebooks allow identifiers to be reassigned in different cells by tracking references by the identifier **and** persistent cell id, ensuring each reference is not ambiguous. Identifiers are disambiguated by suffixes indicating the cell by an assigned name or unique hexadecimal identifier.

## Quickstart

1. Install dfnotebook: `pip install dfnotebook`
2. Start JupyterLab: `jupyter lab`
3. Create a new notebook using the `DFPython 3` kernel.

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
