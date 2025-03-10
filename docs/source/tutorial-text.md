# Tutorial

A dataflow notebook is an extension of the [Jupyter](https://docs.jupyter.org/en/latest/) computational notebook that works with Python. This documentation assumes familiarity with computational notebooks and terminology like cells, outputs, and identifiers. If you are not familiar with what a computational notebook is or the Jupyter project, we highly recommend reviewing those concepts on their [website](https://docs.jupyter.org/en/latest/) and [trying](https://docs.jupyter.org/en/latest/start/index.html#try-the-jupyterlab-interface) the [JupyterLab](https://jupyterlab.readthedocs.io/en/latest/) interface. There is also an extensive [user guide](https://jupyterlab.readthedocs.io/en/latest/user/index.html) for JupyterLab.

There are a few key differences between how dataflow notebooks work compared to classic Jupyter notebooks. Most importantly, cells are linked when one cell references the output of another, forming a dependency graph that allows us to determine which cells depend on others or are depended on by other cells.

## Variables and Outputs

You can use variables in a dataflow notebook in much the same way as in a Jupyter notebook with a key difference: a variable cannot be referenced across cells unless it is denoted as an output. Thus, transient identifiers like a counter `i` used in a loop are valid only in the current cell by default. To ensure that an identifier can referenced, it needs to be listed on the **last line** of the cell. The last-line distinction is something that is used in Jupyter notebooks to output that expression. In dataflow notebooks, any variable or assignment on the last line both outputs the expression and makes it usable in other cells. A single cell with the code `a = 3 * 4` means that `a` is assigned the expression's value, 12, that value is shown as the output, and we can reference `a` in another cell.

```
a = 3 * 4
```

However, if that cell instead defined `b` on the first line and `c` on the second line, only `c` would be output and accessible. `b` would not.

```
b = 1 * 2
c = 3 * 4
```

To make multiple variables accessible, you can list them as a tuple in the last time.

```
d = 1 * 2
e = 3 * 4
d, e
```

You can also use simultaneous assignment to set the values at the same time.

```
i, j = 1 * 2, 3 * 4
```

You might notice that each of the outputs of the cells are **labeled** with the name of the variable. In Jupyter, outputs are labeled with numbers that change with each execution, and a tuple of outputs is presented as a single output rendered as a (textual) tuple. This means that you can scan through a notebook and see all of the variables that can be referenced in other cells **and** a representation of their values!

## Reusing Identifiers

When coding, people often lodge variable identifiers in their memory so that they can reference them later. For a data scientist, the dataframe they are currently analyzing is often identified as `df`. When manipulating a dataframe (e.g. cleaning or transforming it), it is often useful to see the results of particular changes as they are developed in a step-by-step manner. However, giving a different name to each one of the intermediate outputs can be tedious (`df1`, `df2`, `df3`, ...) and error-prone so the identifier `df` may be reused to represent the "current" state of the dataframe. If we only link cells based on their named outputs, this introduces an ambiguity which plagues Jupyter notebooks: which `df` are we referencing at any given point? Since cells can be reordered and executed in different orders, the exact dependencies between the assignments to `df` can be impossible to follow.

### Cell Identifiers

In a dataflow notebook, each cell has a **persistent** identifier so unlike Jupyter notebooks where the cell is numbered based on when it was executed. Jupyter's numeric identifier changes if a cell is re-executed, meaning it is not a useful way to reference the cell. Since cells can be reordered in a notebook, we use and display the universally unique identifier (UUID) that Jupyter assigns when creating a cell as a hexadecimal string. This identifier is truncated to eight characters for brevity. Generally, there is no need to remember these identifiers as cells can also be named, but the notebook keeps track so that it can properly link cells.

### Output References

A dataflow notebook stores **both** the variable name and the cell identifier for any referenced identifier. When a variable is output only once, the cell identifier is superfluous, but when it is repeatedly used, we can disambiguate the reference by appending its cell identifier. This is done by modifying Python's syntax to allow an identifier to use the `$` symbol. Thus, in the following sequence of cells, we can see which `x` is being referenced in the final cell by looking at the appended identifier:

```
x = 1 * 2
```

```
x = 3 * 4
```

```
x$abcdef01 ** 2
```

In cases where the reference is not potentially ambiguous, we hide the persistent identifier, but we always record it with the notebook so that if it ever becomes ambiguous, we can display the correct references.

Note that you are not required to add the `$`-suffix. Whenever an identifier is referenced (even if the reference is ambiguous), the notebook will default to associating the identifier with the **most recently executed** cell with that output. If you wish to reference a different cell, you can enter the variable name and then use Jupyter's tab completion to choose the cell you wish to reference.

[video/gif]

## Cell Names

While a cell's hexadecimal identifiers are unique and may remind git users of the hashes used to identify content or commits, they are generally difficult to remember. To address this, dataflow notebooks support user-defined cell names. A user can select any cell they wish to recall and then set its name through a dialog. Then, when programming, a user can type the name of a reference and disambiguate it by adding the cell name as a suffix in the same way that an identifier is used. If a cell is named later, the notebook will update the display of any references to show that reference.

```tag("first")
y = 1 * 2
```

```
y = 3 * 4
```

```
y$first ** 2
```

Cell names must be unique in a given notebook but they are not permanent. This means that you can change the name of a cell or move a name from one cell to another. The cell's unique hexadecimal identifier will always remain the same, and all code is persisted with that identifier. Thus, we automatically check and update the displayed code in any cell to match the new or changed names.

## Functions, Classes, and Modules

As Python functions, classes, and modules all have associated identifiers, the same rules that apply to a variable apply to these entities. Thus, if you want to use a function or class defined in one cell in another, you need to make sure it is listed on the last line in addition.

```
def f(x):
    return x ** 2
f
```

```
class Point:
    def __init__(self, x, y):
        self.x = x
        self.y = y
Point
```

For imported modules, it becomes a bit tedious to list all imported identifiers twice so the notebook detects any imports and **automatically** classifies them as outputs.

```
import collections.abc
from collections import Counter
```

## The Dependency Viewer

While you should be able to derive the dependencies between cells from the code, this can be a cumbersome task. To help understand the relationships between cells, we provide graph and minimap visualizations. The graph visualization shows a node-link diagram which displays cells and their outputs and links the inputs for each cell to the corresponding outputs of the other cell. By highlighting a node, you can see all of the upstream or downstream dependencies of that cell.

[video/gif]

The minimap visualization is inspired by [Observable](https://observablehq.com) and shows all cells in a vertical table. However, each row also has a dot for each cell along with a whisker to the left if there are upstream dependencies and whisker to the right if there are downstream dependencies. Selecting a cell/row highlights all of the upstream and downstream locations for that cell. The consistent layout allows a more compact view of the dependencies but does not provide the same overview that the graph visualization does.

[video/gif]