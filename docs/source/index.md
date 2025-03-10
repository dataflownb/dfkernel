# Dataflow Notebook

Dataflow notebooks are Jupyter notebooks written in Python that elevate outputs to link cells. Outputs of cells are labeled by their identifiers. Referencing an output of one cell in another cell creates a dependency between between the two cells, allowing the system to ensure upstream cells are up-to-date before executing a cell. Dataflow notebooks allow identifiers to be reassigned in different cells by tracking references by the identifier **and** persistent cell id, ensuring each reference is not ambiguous. Identifiers are disambiguated by suffixes indicating the cell by an assigned name or unique hexadecimal identifier.

![Dataflow Notebook](./notebooks/images/example_use.png)

## Quickstart

1. Install dfnotebook: `pip install dfnotebook`
2. Start JupyterLab: `jupyter lab`
3. Create a new notebook using the `DFPython 3` kernel.

## Build (Using Anaconda)

These are sample instructions.

```
conda create --name dfnotebook -y jupyterlab
conda activate dfnotebook

git clone https://github.com/dataflownb/dfnotebook.git

cd dfnotebook
pip install -e .

# At this point you can use the dfnotebooks
jupyter lab

# For development, create the symlink
cd frontend
jlpm develop

# To build the extension
cd frontend
jlpm build
```

## Contents

```{toctree}

notebooks/tutorial.ipynb
notebooks/dependencies.ipynb
notebooks/cell-names.ipynb
examples.md
```

