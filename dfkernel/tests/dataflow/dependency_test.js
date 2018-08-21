//
// Test javascript side dependencies are accurate
//
casper.notebook_test(function () {

    function get_outputs(cell_idx) {
        var outputs_json = casper.evaluate(function (cell_idx) {
            var cell = Jupyter.notebook.get_cell(cell_idx);
            return JSON.stringify(cell.output_area.outputs);
        }, {cell_idx: cell_idx});
        return JSON.parse(outputs_json);
    }

    function get_all_up_deps(cell_idx) {
        var outputs = casper.evaluate(function (cell_idx) {
            var cell = Jupyter.notebook.get_cell(cell_idx);
            var childnodes = cell.dfgraph.get_all_upstreams(cell.uuid);
            return childnodes;
        }, {cell_idx: cell_idx});
        return outputs;
    }

    function get_imm_up_deps(cell_idx) {
        var outputs = casper.evaluate(function (cell_idx) {
            var cell = Jupyter.notebook.get_cell(cell_idx);
            return cell.dfgraph.get_upstreams(cell.uuid);
        }, {cell_idx: cell_idx});
        return outputs;
    }

    function get_imm_downstreams(cell_idx) {
        var outputs = casper.evaluate(function (cell_idx) {
            var cell = Jupyter.notebook.get_cell(cell_idx);
            return cell.dfgraph.get_downstreams(cell.uuid);
        }, {cell_idx: cell_idx});
        return outputs;
    }


    this.wait_for_kernel_ready();

    this.then(function(){
    this.then(function () {

        this.evaluate(function () {
            Jupyter.notebook.insert_cell_at_index("code", 0);
            var cell = Jupyter.notebook.get_cell(0);
            cell.uuid = 'aaaaaa';
            cell.set_text('a=3');
            cell.execute();
        });

        this.wait_for_output(0);

        this.then(function () {
            var outputs = get_outputs(0);
            this.test.assertEquals(outputs[0].data['text/plain'], '3', 'cell 0 produces the correct output');
        });
    });

    this.then(function () {
        this.evaluate(function () {
            Jupyter.notebook.insert_cell_at_index("code", 1);
            var cell = Jupyter.notebook.get_cell(1);
            cell.uuid = 'bbbbbb';
            cell.set_text('6');
            cell.execute();
        });

        this.wait_for_output(1);

        this.then(function () {
            var outputs = get_outputs(1);
            this.test.assertEquals(outputs[0].data['text/plain'], '6', 'cell 1 produces the correct output');
        });
    });

    this.then(function () {
        this.evaluate(function () {
            Jupyter.notebook.insert_cell_at_index("code", 2);
            var cell = Jupyter.notebook.get_cell(2);
            cell.uuid = 'cccccc';
            cell.set_text('c=a+4');
            cell.execute();
        });

        this.wait_for_output(2);

        this.then(function () {
            var outputs = get_outputs(2);
            this.test.assertEquals(outputs[0].data['text/plain'], '7', 'cell 2 produces the correct output');
        });
    });

    this.then(function () {
        this.evaluate(function () {
            Jupyter.notebook.insert_cell_at_index("code", 3);
            var cell = Jupyter.notebook.get_cell(3);
            cell.uuid = 'dddddd';
            cell.set_text('Out[bbbbbb]+2*c');
            cell.execute();
        });

        this.wait_for_output(3);

        this.then(function () {
            var outputs = get_outputs(3);
            this.test.assertEquals(outputs[0].data['text/plain'], '20', 'cell 3 produces the correct output');
            var immdowndeps = get_imm_downstreams(0);
            this.test.assertEquals(immdowndeps.sort().join(','), ["cccccc"].sort().join(','), "cell 0 produces the correct Immediate Downstream Dependencies");
            var immdowndeps = get_imm_downstreams(1);
            this.test.assertEquals(immdowndeps.sort().join(','), ["dddddd"].sort().join(','), "cell 1 produces the correct Immediate Downstream Dependencies");
            var immdowndeps = get_imm_downstreams(2);
            this.test.assertEquals(immdowndeps.sort().join(','), ["dddddd"].sort().join(','), "cell 2 produces the correct Immediate Downstream Dependencies");
            var immupdeps = get_imm_up_deps(3);
            this.test.assertEquals(immupdeps.sort().join(','), ["bbbbbb", "ccccccc"].sort().join(','), "cell 3 produces the correct Immediate Upstream Dependencies");
            var allupdeps = get_all_up_deps(3);
            this.test.assertEquals(allupdeps.sort().join(','), ["aaaaaa", "bbbbbb", "cccccc"].sort().join(','), "cell 3 produces the correct Immediate Upstream Dependencies");
        });
    });
    });
    //Have to wrap these seperately so that all other cells get executed first
    this.then(function(){
        this.evaluate(function () {
            var cell = Jupyter.notebook.get_cell(2);
            cell.set_text('c = 4');
            cell = Jupyter.notebook.get_cell(3);
            cell.execute();
        });

        this.wait_for_output(2);
        this.wait_for_output(3);

        this.then(function () {
            var immdowndeps = get_imm_downstreams(0);
            this.test.assertEquals(immdowndeps, [], "cell 0 produces the correct Immediate Downstream Dependencies");
            var immdowndeps = get_imm_downstreams(1);
            this.test.assertEquals(immdowndeps.sort().join(','), ["dddddd"].sort().join(','), "cell 1 produces the correct Immediate Downstream Dependencies");
            var immdowndeps = get_imm_downstreams(2);
            this.test.assertEquals(immdowndeps.sort().join(','), ["dddddd"].sort().join(','), "cell 2 produces the correct Immediate Downstream Dependencies");
            var outputs = get_outputs(2);
            this.test.assertEquals(outputs[0].data['text/plain'], '4', 'cell 2 produces the correct output');
            var immupdeps = get_imm_up_deps(2);
            this.test.assertEquals(immupdeps.sort().join(','), [].sort().join(','), "cell 2 produces the correct Immediate Upstream Dependencies");
            var outputs = get_outputs(3);
            this.test.assertEquals(outputs[0].data['text/plain'], '14', 'cell 3 produces the correct output');
            var immupdeps = get_imm_up_deps(3);
            this.test.assertEquals(immupdeps.sort().join(','), ["bbbbbb", "ccccccc"].sort().join(','), "cell 3 produces the correct Immediate Upstream Dependencies");
            var allupdeps = get_all_up_deps(3);
            this.test.assertEquals(allupdeps.sort().join(','), ["bbbbbb", "cccccc"].sort().join(','), "cell 3 produces the correct Immediate Upstream Dependencies");

        });
    });

});
