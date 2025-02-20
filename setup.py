from pathlib import Path
from setuptools import setup, find_packages

local_kernel: str = (Path(__file__).parent / "kernel").as_uri()
local_frontend: str = (Path(__file__).parent / "frontend").as_uri()

setup(
    name="dfmain",
    version="0.1.0",
    install_requires=[
        f"dfkernel @ {local_kernel}",
        f"dfnotebook @ {local_frontend}",
    ],
    include_package_data=True,
)
