# [Dataflow Python Kernel for the Jupyter Notebook](http://github.com/dataflownb/dfkernel/)

[![License](https://img.shields.io/badge/License-BSD3-blue.svg)](https://github.com/dataflownb/dfkernel/blob/master/LICENSE)
[![PyPI version](https://badge.fury.io/py/dfkernel.svg)](https://badge.fury.io/py/dfkernel)
[![Build Status](https://travis-ci.com/colinjbrown/dfkernel.svg?branch=master)](https://travis-ci.org/colinjbrown/dfkernel)
[![Documentation Status](https://readthedocs.org/projects/dfkernel/badge/?version=stable)](http://dfkernel.readthedocs.io/en/stable/?badge=stable)

This package provides the Dataflow Python kernel for Jupyter. 
This kernel modifies underlying Ipykernel and Jupyter Notebook classes with these intentions in mind: 
- Changes numeric cells to persistent ids, only one unique id can exist for each cell 
- Implement a recursive dataflow mechanism for cell execution: if a cell references the output of another cell, the kernel will check if cell is up-to-date and execute it if it is not. 

For example:

```
In [a4bc1f]: 1 + 1
Out[a4bc1f]: 2

In [c1428f]: Out[a4bc1f] ** 10
Out[c1428f]: 1024
```

Modifying the first cell to be 1 + 2, but executing only the second cell will cause the first cell to be re-evaluated because it changed.

The kernel has since evolved to rely not only single output tags but to also allow the export of any number of semantic outputs. This means that we now allow behavior like the following:

```
In [a4bc1f]: a,b = 3,4
          a: 3
          b: 4
          
In [c1428f]: c = a+3
          c: 6
```

We also provide a graph that is updated in real time to show these kind of relationships.

![Dataflow Kernel Graph](https://cdn.rawgit.com/dataflownb/dfkernel/documentation-update/docs/tutorial/img/stage2.svg)

## Requirements

Python >= 3.5

Notebook >= 5.0

Ipykernel >= 4.8.2

## Installation

### PyPI

`pip install dfkernel`

### From source

1. `git clone https://github.com/dataflownb/dfkernel`
2. `cd dfkernel`
3. `pip install -e .`
4. `python -m dfkernel install [--user|--sys-prefix]`

Note that `--sys-prefix` works best for conda environments.

## Documentation
The Dataflow kernel documentation is hosted [here](http://dfkernel.readthedocs.io/en/latest/).

A basic tutorial can be found [here](http://dfkernel.readthedocs.io/en/latest/dfkernel-tutorial.html)

#### More advanced tutorials
[Dependency Viewer Tutorial](http://dfkernel.readthedocs.io/en/latest/dep-view-tutorial.html)

[Dependency Workings and Cell Toolbar](http://dfkernel.readthedocs.io/en/latest/dependency-cell-toolbar.html)

[Notebook Interactions](http://dfkernel.readthedocs.io/en/latest/notebook-interactions.html)

[Cell Statuses](http://dfkernel.readthedocs.io/en/latest/dfkernel-statuses.html)

## Video
This is a video of the previous version of the [Dataflow Kernel](http://www.youtube.com/watch?v=lAfywCbp7qU)

## Return to the Standard IPython Notebook

This tool relies on RedBaron to topologically sort your Notebooks so that they are topologically sorted so you can easily switch back and forth from an Ipykernel Notebook to a Dfkernel Notebook.

This is provided as a [separate bundler extension](https://github.com/dataflownb/dfconvert).
