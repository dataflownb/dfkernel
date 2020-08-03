"""An Application for launching a kernel"""

from __future__ import print_function

import ipykernel.kernelapp
from ipykernel.kernelapp import *

import sys

from IPython.core.profiledir import ProfileDir
from traitlets import (
    DottedObjectName, Type
)
from .ipkernel import IPythonKernel
from jupyter_client.session import Session
from .zmqshell import ZMQInteractiveShell

#-----------------------------------------------------------------------------
# Application class for starting an IPython Kernel
#-----------------------------------------------------------------------------

class IPKernelApp(ipykernel.kernelapp.IPKernelApp):
    name='dfpython-kernel'
    classes = [IPythonKernel, ZMQInteractiveShell, ProfileDir, Session]
    # the kernel class, as an importstring
    kernel_class = Type('dfkernel.ipkernel.IPythonKernel',
                        klass='ipykernel.kernelbase.Kernel',
    help="""The Kernel subclass to be used.

    This should allow easy re-use of the IPKernelApp entry point
    to configure and launch kernels other than IPython's own.
    """).tag(config=True)

    subcommands = {
        'install': (
            'dfkernel.kernelspec.InstallIPythonKernelSpecApp',
            'Install the DFPython kernel'
        ),
    }

    outstream_class = DottedObjectName('dfkernel.iostream.OutStream',
        help="The importstring for the OutStream factory").tag(config=True)
    displayhook_class = DottedObjectName('dfkernel.displayhook.ZMQDisplayHook',
        help="The importstring for the DisplayHook factory").tag(config=True)

    def init_kernel(self):
        super(IPKernelApp, self).init_kernel()

        # self.display_pub.get_execution_count = lambda: kernel.execution_count
        sys.stdout.get_execution_count = lambda: int(self.kernel.execution_count, 16) if self.kernel.execution_count else None
        sys.stderr.get_execution_count = lambda: int(self.kernel.execution_count, 16) if self.kernel.execution_count else None

launch_new_instance = IPKernelApp.launch_instance

def main():
    """Run an IPKernel as an application"""
    app = IPKernelApp.instance()
    app.initialize()
    app.start()

if __name__ == '__main__':
    main()
