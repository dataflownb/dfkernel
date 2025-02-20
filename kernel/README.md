# Dataflow Kernel for Jupyter/Python

[![License](https://img.shields.io/badge/License-BSD3-blue.svg)](https://github.com/dataflownb/dfkernel/blob/master/LICENSE)
[![PyPI version](https://badge.fury.io/py/dfkernel.svg)](https://badge.fury.io/py/dfkernel)
<!--
[![Build Status](https://travis-ci.org/dataflownb/dfkernel.svg?branch=master)](https://travis-ci.org/dataflownb/dfkernel)
[![Documentation Status](https://readthedocs.org/projects/dfkernel/badge)](http://dfkernel.readthedocs.io/)
[![Binder](https://mybinder.org/badge.svg)](https://mybinder.org/v2/gh/dataflownb/dfexamples/master)
-->

This package is part of the [Dataflow Notebooks](https://dataflownb.github.io) project and provides the Dataflow Python kernel for Jupyter, and is intended to be used with [JupyerLab](https://github.com/jupyterlab/jupyterlab/)
in concert with the [dfnotebook-extension](https://github.com/dataflownb/dfnotebook-extension).
This kernel seeks to elevate *outputs* as memorable waypoints during exploratory computation. To that end,

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

## Installation

These instructions **only install the kernel**. Please see the 
[dfnotebook-extension](https://github.com/dataflownb/dfnotebook-extension)
instructions for full instructions.

### PyPI

`pip install dfkernel`

### From source

1. `git clone https://github.com/dataflownb/dfkernel`
2. `cd dfkernel`
3. `pip install -e .`
4. `python -m dfkernel install [--user|--sys-prefix]`

Note that `--sys-prefix` works best for conda environments.

### Dependencies

* IPython >= 7.0
* JupyterLab >= 2.0
* ipykernel >= 4.8.2

## Previous Versions

dfkernel 1.0 worked with Jupyter Notebook, but we have decided to support JupyterLab in the future. Documentation and tutorials for v1.0 are below, but still need to be updated for v2.0.

### v1.0 Documentation

#### General
- [readthedocs](http://dfkernel.readthedocs.io/en/latest/)
- [tutorial](http://dfkernel.readthedocs.io/en/latest/dfkernel-tutorial.html)

#### Advanced Usage
- [Dependency Viewer Tutorial](http://dfkernel.readthedocs.io/en/latest/dep-view-tutorial.html)
- [Dependency Workings and Cell Toolbar](http://dfkernel.readthedocs.io/en/latest/dependency-cell-toolbar.html)
- [Notebook Interactions](http://dfkernel.readthedocs.io/en/latest/notebook-interactions.html)
- [Cell Statuses](http://dfkernel.readthedocs.io/en/latest/dfkernel-statuses.html)
