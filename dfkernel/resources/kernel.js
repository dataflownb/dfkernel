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
        "require",
        './df-notebook/depview.js',
        './df-notebook/dfgraph.js',
        './df-notebook/toolbar.js',
        './df-notebook/codecell.js',
        './df-notebook/completer.js',
        './df-notebook/kernel.js',
        './df-notebook/notebook.js',
        './df-notebook/outputarea.js',
    ],
    function($, Jupyter, require, depview, dfgraph, df_toolbar) {

        Jupyter._dfkernel_loaded = false;

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
            // load the toolbar
            df_toolbar.register(nb);

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

            // hack to get widget auto-updates working...
            (function(_super) {
                Object.getPrototypeOf(Jupyter.notebook.kernel.widget_manager).create_view = function(model, options) {
                    var _super_result = _super.apply(this, arguments);
                    model.on('change:value', function() {
                        var m = this;
                        var view_ids = Object.keys(m.views);
                        view_ids.forEach(function (vid) {
                            m.views[vid].then(function(view) {
                                // console.log("CELL CHANGE:", cell, m.get('value'));
                                var cell = Jupyter.notebook.get_code_cell(view.options.output.execution_count);
                                // want to do downstream execution only
                                Jupyter.notebook.session.dfgraph.get_downstreams(cell.uuid).forEach(function(cid) {
                                    // console.log("DOWNSTREAM", cid);
                                    if (Jupyter.notebook.get_code_cell(cid).metadata.auto_update) {
                                        Jupyter.notebook.get_code_cell(cid).execute();
                                    }
                                });
                            });
                        });
                    }, model);
                    return _super_result;
                };
            }(Object.getPrototypeOf(Jupyter.notebook.kernel.widget_manager).create_view));


            Jupyter.toolbar.add_buttons_group([
                  {
                       'label'   : 'Open/Close Dependency View',
                       'icon'    : 'fa-bar-chart',
                       'callback': function () {
                                                     nb.session.dfgraph.depview.toggle_dep_view();
                       }

               }]);
                var stylesheet = $('<link rel="stylesheet" type="text/css">');
                stylesheet.attr('href',require.toUrl("./df-notebook/css/icon.css"));
                $('head').append(stylesheet);

        };
        return {onload:onload};
});
