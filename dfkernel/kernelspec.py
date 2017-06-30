"""The DFPython kernel spec for Jupyter"""

from __future__ import print_function

from ipykernel.kernelspec import *

import os
import sys

pjoin = os.path.join

KERNEL_NAME = 'dfpython%i' % sys.version_info[0]

# path to kernelspec resources
RESOURCES = pjoin(os.path.dirname(__file__), 'resources')


def make_ipkernel_cmd(mod='dfkernel_launcher', executable=None, extra_arguments=None, **kw):
    """Build Popen command list for launching an IPython kernel.

    Parameters
    ----------
    mod : str, optional (default 'dfkernel')
        A string of an IPython module whose __main__ starts an IPython kernel

    executable : str, optional (default sys.executable)
        The Python executable to use for the kernel process.

    extra_arguments : list, optional
        A list of extra arguments to pass when executing the launch code.

    Returns
    -------

    A Popen command list
    """
    if executable is None:
        executable = sys.executable
    extra_arguments = extra_arguments or []
    arguments = [executable, '-m', mod, '-f', '{connection_file}']
    arguments.extend(extra_arguments)

    return arguments


def get_kernel_dict(extra_arguments=None):
    """Construct dict for kernel.json"""
    return {
        'argv': make_ipkernel_cmd(extra_arguments=extra_arguments),
        'display_name': 'DFPython %i' % sys.version_info[0],
        'language': 'python',
    }

if __name__ == '__main__':
    InstallIPythonKernelSpecApp.launch_instance()
