from traitlets import Instance, Unicode, Dict, Any, default

from ipykernel.comm import CommManager as BaseCommManager


class CommManager(BaseCommManager):
    """Manager for Comms in the Kernel"""

    kernel = Instance('dfkernel.kernelbase.Kernel')
    comms = Dict()
    targets = Dict()

__all__ = ['CommManager']
