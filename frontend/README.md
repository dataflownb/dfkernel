# dfnotebook-extension

A JupyterLab extension that facilitates dataflow notebooks using [dfkernel](https://github.com/dataflownb/dfkernel).

This extension uses a Jupyter kernel named [`dfkernel`](https://github.com/dataflownb/dfkernel) 
for the backend and a NPM package named `dfnotebook-extension`
for the frontend extension.

## Requirements

* JupyterLab >= 2.0

## Install

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
