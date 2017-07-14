# Dataflow Python Kernel for Jupyter

This package provides the Dataflow Python kernel for Jupyter. This kernel modifies ipykernel and the notebook in two key ways: (1) it changes the numeric cell ids to persistent, unique ids for each cell, and (2) it implements a recursive dataflow mechanism for cell execution: if a cell references the output of another cell, we will check if cell is up-to-date and execute it if it is not. For example:

```
In [34bc1f]: 1 + 1
Out[34bc1f]: 2

In [51428f]: Out["34bc1f"] ** 10
Out[51428f]: 1024
```

Modifying the first cell to be 1 + 2, but executing only the second cell will cause the first cell to be re-evaluated because it changed.

## Installation from PyPI

`pip install dfkernel`

## Installation from source

1. Clone the repository
2. `cd dfkernel`
3. `pip install -e .`
4. `python -m dfkernel install [--user|--sys-prefix]`

Note that --sys-prefix works best for conda environments.


## Convert dfkernel notebooks to ipykernel notebooks

https://github.com/dataflownb/dfconvert
