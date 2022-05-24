# flake8: noqa: F401
import json
from pathlib import Path

from ._version import __version__


HERE = Path(__file__).parent.resolve()


with (HERE / "labextension" / "package.json").open() as fid:
    data = json.load(fid)


def _jupyter_labextension_paths():
    return [{
        "src": "labextension",
        "dest": data["name"]
    }]

# from ._version import __version__


# def _jupyter_labextension_paths():
#     return [
#         {
#             "src": "labextensions/@dfnotebook/dfnotebook",
#             "dest": "@dfnotebook/dfnotebook",
#         },
#         {
#             "src": "labextensions/@dfnotebook/dfoutputarea",
#             "dest": "@dfnotebook/dfoutputarea",
#         },
#         {
#             "src": "labextensions/@dfnotebook/dfcells",
#             "dest": "@dfnotebook/dfcells",
#         },
#         {
#             "src": "labextensions/@dfnotebook/dfnotebook-extension",
#             "dest": "@dfnotebook/dfnotebook-extension",
#         },
#     ]