"""
dfnotebook_extension setup
"""
import json
import sys
from pathlib import Path
import os

import setuptools

HERE = Path(__file__).parent.resolve()

main_package_name = 'dfnotebook-extension'
# The name of the project
names = ["dfoutputarea","dfcells","dfnotebook",main_package_name]

# Get the package info from package.json
pkg_json = []
for i in names:
    with open(os.path.join(HERE,i,"package.json")) as f:
        pkg_json.append(json.load(f))
#print([json.loads((os.path.join(HERE,i,"package.json"))) for i in names])
#pkg_json = [json.loads((os.path.join(HERE,i,"package.json"))).read_bytes() for i in names]


lab_paths = [Path(HERE / i / pkg["jupyterlab"]["outputDir"]) for (i,pkg) in zip(names,pkg_json)]
#print(lab_paths)

# Representative files that should exist after a successful build
ensured_targets = [
    str(os.path.join(lab_paths[names.index(main_package_name)],"package.json")),
    str(os.path.join(lab_paths[names.index(main_package_name)],"static/style.js"))
]

labext_names = [pkg["name"] for pkg in pkg_json]

data_files_spec = []
for lab_name,lab_path,name in zip(labext_names,lab_paths,names):
    lab_path = Path(lab_path)
    data_files_spec.append(("share/jupyter/labextensions/%s" % str(lab_name), str(lab_path.relative_to(Path(HERE / name))), "**"))
#FIXME: Do we only need one install.json file?
data_files_spec.append(("share/jupyter/labextensions/%s" % str(lab_name[names.index(main_package_name)]), str("."), "install.json"))

# data_files_spec = [
#     ("share/jupyter/labextensions/%s" % labext_name, str(lab_path.relative_to(HERE)), "**"),
#     ("share/jupyter/labextensions/%s" % labext_name, str("."), "install.json"),
# ]

long_description = (HERE / "README.md").read_text()

pkg_info = pkg_json[names.index(main_package_name)]


version = (
    pkg_info["version"]
    .replace("-alpha.", "a")
    .replace("-beta.", "b")
    .replace("-rc.", "rc")
)

setup_args = dict(
    name=name,
    version=version,
    url=pkg_info["homepage"],
    author=pkg_info["author"]["name"],
    author_email=pkg_info["author"]["email"],
    description=pkg_info["description"],
    license=pkg_info["license"],
    license_file="LICENSE",
    long_description=long_description,
    long_description_content_type="text/markdown",
    packages=setuptools.find_packages(),
    #FIXME: Change this when ipy8 branch gets merged in
    install_requires=['dfkernel@git+https://github.com/dataflownb/dfkernel.git@9005725016811c44602c21ccc782d31e74a076b7'],
    zip_safe=False,
    include_package_data=True,
    python_requires=">=3.7",
    platforms="Linux, Mac OS X, Windows",
    keywords=["Jupyter", "JupyterLab", "JupyterLab3"],
    classifiers=[
        "License :: OSI Approved :: BSD License",
        "Programming Language :: Python",
        "Programming Language :: Python :: 3",
        "Programming Language :: Python :: 3.7",
        "Programming Language :: Python :: 3.8",
        "Programming Language :: Python :: 3.9",
        "Programming Language :: Python :: 3.10",
        "Framework :: Jupyter",
        "Framework :: Jupyter :: JupyterLab",
        "Framework :: Jupyter :: JupyterLab :: 3",
        "Framework :: Jupyter :: JupyterLab :: Extensions",
        "Framework :: Jupyter :: JupyterLab :: Extensions :: Prebuilt",
    ],
)

try:
    from jupyter_packaging import (
        wrap_installers,
        npm_builder,
        get_data_files
    )
    post_develop = npm_builder(
        build_cmd="install:full", source_dir="src", build_dir=lab_path
    )
    setup_args["cmdclass"] = wrap_installers(post_develop=post_develop, ensured_targets=ensured_targets)
    setup_args["data_files"] = get_data_files(data_files_spec)
except ImportError as e:
    import logging
    logging.basicConfig(format="%(levelname)s: %(message)s")
    logging.warning("Build tool `jupyter-packaging` is missing. Install it with pip or conda.")
    if not ("--name" in sys.argv or "--version" in sys.argv):
        raise e

if __name__ == "__main__":
    setuptools.setup(**setup_args)