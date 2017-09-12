define(["jquery",
    "base/js/namespace",
    '/kernelspecs/dfpython3/df-notebook/depview.js',
    '/kernelspecs/dfpython3/df-notebook/codecell.js',
    '/kernelspecs/dfpython3/df-notebook/completer.js',
    '/kernelspecs/dfpython3/df-notebook/kernel.js',
    '/kernelspecs/dfpython3/df-notebook/notebook.js',
    '/kernelspecs/dfpython3/df-notebook/outputarea.js'
    ],
    function($, Jupyter, depview) {
        var onload = function() {
            // reload the notebook after patching code
            var nb = Jupyter.notebook;
            var kernelspec = nb.metadata.kernelspec;
            console.log("NB PATH:", nb.notebook_path);
            console.log("KERNEL SPEC:", kernelspec);
            // FIXME do the kernelspec patch here instead of
            // in patch of load_notebook_success
            nb.contents.get(nb.notebook_path, {type: 'notebook'}).then(
                $.proxy(nb.reload_notebook, nb),
                $.proxy(nb.load_notebook_error, nb)
            );

            // add event to be notified when cells need to be resent to kernel
            nb.events.on('kernel_ready.Kernel', function(event, data) {
                nb.invalidate_cells();
            });

            var depdiv = depview.create_dep_div();

            Jupyter.toolbar.add_buttons_group([
                  {
                       'label'   : 'See Cell Dependencies',
                       'icon'    : 'fa-bar-chart',
                       'callback': function () {
                                                     depview.create_dep_view(depdiv);

                       }
               }]);

            // the kernel was already created, but $.proxy settings will
            // reference old handlers so relink them
            // needed to get execute_input messages
            nb.session.kernel.init_iopub_handlers();
        };

        return {onload:onload}
});
