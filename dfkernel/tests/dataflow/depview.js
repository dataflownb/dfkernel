//
// Test depviewer rendering
//
casper.notebook_test(function () {


    //FIXME: Find some way to test the actual vis

     casper.get_edges = function() {
        return casper.evaluate(function () {
            return Jupyter.notebook.session.dfgraph.depview.cell_links.length;
        });
    };

     casper.get_cells = function(){
        return casper.evaluate(function () {
            return Jupyter.notebook.session.dfgraph.depview.cell_list.length;
        });
    };

     casper.get_outs = function() {
        return casper.evaluate(function () {
            return Object.keys(Jupyter.notebook.session.dfgraph.depview.output_nodes).length;
        });
    };

    casper.wait_for_render = function () {
        this.wait_for_idle();
        this.then(function() {
            this.waitFor(function () {
                return this.evaluate(function get_render() {
                    var render_status = Jupyter.notebook.session.dfgraph.depview.done_rendering;
                    return !(render_status);
                }),
                    function then() {
                    },
                    function timeout() {
                        this.echo("wait_for_render timed out.");
                    }
            });
        });
    };

    casper.get_graph_dot = function(){
        return casper.evaluate(function () {
            return Jupyter.notebook.session.dfgraph.depview.dotgraph;
        });
    };

    this.wait_for_kernel_ready();


    this.then(function(){
        this.evaluate(function () {
            Jupyter.notebook.insert_cell_at_index("code", 0);
            var cell = Jupyter.notebook.get_cell(0);
            cell.set_text('a=3');
            cell.execute();
        });
    });

    this.wait_for_output(0);

    this.then(function () {
        this.evaluate(function () {
           Jupyter.notebook.session.dfgraph.depview.toggle_dep_view();
        });
    });

    this.then(function () {
        this.evaluate(function () {
            Jupyter.notebook.insert_cell_at_index("code", 1);
            var cell = Jupyter.notebook.get_cell(1);
            cell.set_text('b = a+2');
            cell.execute();
        });
    });

    this.wait_for_output(1);


    this.wait_for_render();

    this.then(function () {
        var edges = this.get_edges();
        var cells = this.get_cells();
        var outs = this.get_outs();
        this.test.assertEquals(edges, 1, 'correct number of edges on screen');
        this.test.assertEquals(cells, 2, 'correct number of cells on screen');
        this.test.assertEquals(outs, 2, 'correct number of output tags on screen');
    });

    this.then(function () {
        this.evaluate(function () {
            Jupyter.notebook.insert_cell_at_index("code", 2);
            var cell = Jupyter.notebook.get_cell(2);
            cell.set_text('c=b+3');
            cell.execute();
        });
    });

    this.wait_for_output(2);

    this.wait_for_render();

    this.then(function () {
        var edges = this.get_edges();
        var cells = this.get_cells();
        var outs = this.get_outs();
        this.test.assertEquals(edges, 2, 'correct number of edges on screen');
        this.test.assertEquals(cells, 3, 'correct number of cells on screen');
        this.test.assertEquals(outs, 3, 'correct number of output tags on screen');
    });

    this.then(function () {
        this.evaluate(function () {
            Jupyter.notebook.insert_cell_at_index("code", 2);
            var cell = Jupyter.notebook.get_cell(2);
            cell.set_text('print(c)');
            cell.execute();
        });
    });

    this.wait_for_output(2);

    this.wait_for_render();

    this.then(function () {
        var edges = this.get_edges();
        var cells = this.get_cells();
        var outs = this.get_outs();
        this.test.assertEquals(edges, 3, 'correct number of edges on screen');
        this.test.assertEquals(cells, 4, 'correct number of cells on screen');
        this.test.assertEquals(outs, 4, 'correct number of output tags on screen');
    });

    this.then(function () {
        this.evaluate(function () {
            Jupyter.notebook.session.dfgraph.depview.dataflow = !Jupyter.notebook.session.dfgraph.depview.dataflow;
            Jupyter.notebook.session.dfgraph.depview.startGraphCreation();
        })
    });

    this.wait_for_render();

    this.then(function () {
        var edges = this.get_edges();
        var cells = this.get_cells();
        var outs = this.get_outs();
        this.test.assertEquals(edges, 2, 'correct number of edges on screen');
        this.test.assertEquals(cells, 3, 'correct number of cells on screen');
        this.test.assertEquals(outs, 3, 'correct number of output tags on screen');
    });

});

