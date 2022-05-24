# flake8: noqa: F401
from ._version import __version__


def _jupyter_labextension_paths():
    return [
        {
            "src": "labextensions/@dfnotebook/dfnotebook",
            "dest": "@dfnotebook/dfnotebook",
        },
        {
            "src": "labextensions/@dfnotebook/dfoutputarea",
            "dest": "@dfnotebook/dfoutputarea",
        },
        {
            "src": "labextensions/@dfnotebook/dfcells",
            "dest": "@dfnotebook/dfcells",
        },
        {
            "src": "labextensions/@dfnotebook/dfnotebook-extension",
            "dest": "@dfnotebook/dfnotebook-extension",
        },
    ]