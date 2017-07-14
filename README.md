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

## Usage

dfkernel allows the same python code in each cell that ipykernel does. It adds two additional features to the interface: tab completion of outputs and dependency lists.

### Tab Completion

You can complete a cell output reference by typing the first couple characters of the cell id. For example, typing `34<TAB>` will complete to `Out['34bc1f']`. In addition, typing `_<TAB>` will offer completions of the three most recently executed cells at the top of the list.

### Dependency Selection and Updates

After a cell is executed, a list of both its upstream and downstream dependencies is listed below its output. This allows you to see  which cells impact that cell's output and which cells that cell impacts. For downstream dependencies, an "Execute All" link allows users to update all dependent cells.

## Convert dfkernel notebooks to ipykernel notebooks

You can work in dfkernel and convert your notebook to an ipykernel notebook that executes top-down using the dfconvert tool.

https://github.com/dataflownb/dfconvert
