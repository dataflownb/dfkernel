var path = '../kernelspecs/dfpython3/df-notebook/lib/'

require.config({
        paths: {
            d3: path + "d3/d3.v4.min",
            graphlib: path + "graphlib/graphlib.core.min",
            viz: path + "viz/viz",
            d3graphviz: path + "d3-graphviz/d3-graphviz",
            lodash: path + "lodash/lodash.min",
            graphdotwriter: path + "graphlib-dot/writer"
        },
        shim: {
            d3graphviz: {
              deps: ["d3","viz"],
              exports: "d3",
                init: function() {
                return {
                    d3: d3,
                    viz: graphviz
                };
        }
            },
        }
        });

define(["jquery",
    "base/js/namespace",
    './df-notebook/codecell.js',
    './df-notebook/completer.js',
    './df-notebook/kernel.js',
    './df-notebook/notebook.js',
    './df-notebook/outputarea.js'
    ],
    function($, Jupyter) {

        Jupyter._dfkernel_loaded = false;

        var onload = function() {
            // reload the notebook after patching code
            var nb = Jupyter.notebook;

            nb.contents.get(nb.notebook_path, {type: 'notebook'}).then(
                $.proxy(nb.reload_notebook, nb),
                $.proxy(nb.load_notebook_error, nb)
            );
            
            // add event to be notified when cells need to be resent to kernel
            nb.events.on('kernel_ready.Kernel', function(event, data) {
                nb.invalidate_cells();
                // the kernel was already created, but $.proxy settings will
                // reference old handlers so relink _handle_input_message
                // needed to get execute_input messages
                var k = nb.kernel;
                k.register_iopub_handler('execute_input', $.proxy(k._handle_input_message, k));
                Jupyter._dfkernel_loaded = true;
            });

            var depdiv = depview.create_dep_div();

            Jupyter.toolbar.add_buttons_group([
                  {
                       'label'   : 'See Cell Dependencies',
                       'icon'    : 'fa-bar-chart',
                       'callback': function () {
                                                     depview.create_dep_view(depdiv,true,false);

                       }

               },{
                       'label'   : 'See Data Dependencies',
                       'icon'    : 'fa-bar-chart',
                       'callback': function () {
                                                     depview.create_dep_view(depdiv,false,false);

                       }

               },{
                       'label'   : 'See Semantic View',
                       'icon'    : 'fa-bar-chart',
                       'callback': function () {
                                                     depview.create_dep_view(depdiv,false,true);
                                                     depview.attach_controls(depdiv);

                       }

               }]);
        };
        return {onload:onload};
});
