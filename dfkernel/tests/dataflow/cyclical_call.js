//
// Test cyclical calls to ensure they error out
//
casper.notebook_test(function () {

    function get_outputs(cell_idx) {
        var outputs_json = casper.evaluate(function (cell_idx) {
            var cell = Jupyter.notebook.get_cell(cell_idx);
            return JSON.stringify(cell.output_area.outputs);
        }, {cell_idx: cell_idx});
        return JSON.parse(outputs_json);
    }


    this.wait_for_kernel_ready();

    this.then(function() {
        this.evaluate(function () {
            Jupyter.notebook.insert_cell_at_index("code", 0);
            var cell = Jupyter.notebook.get_cell(0);
            cell.set_text('a=3');
            cell.execute();
        });
    });

    this.wait_for_output(0);

    this.then(function () {
        var outputs = get_outputs(0);
        this.test.assertEquals(outputs.length, 1, 'cell 0 has the right number of outputs');
        this.test.assertEquals(outputs[0].data['text/plain'], '3', 'cell 0 produces the correct output');
        this.test.assertEquals(outputs[0].metadata.output_tag, 'a', 'cell 0 has the correct output_tag');
    });

    this.then(function() {
        this.evaluate(function () {
            Jupyter.notebook.insert_cell_at_index("code", 1);
            var cell = Jupyter.notebook.get_cell(1);
            cell.set_text('b=a+3');
            cell.execute();
        });
    });

    this.wait_for_output(1);

    this.then(function () {
        var outputs = get_outputs(1);
        this.test.assertEquals(outputs.length, 1, 'cell 1 has the right number of outputs');
        this.test.assertEquals(outputs[0].data['text/plain'], '6', 'cell 1 produces the correct output');
        this.test.assertEquals(outputs[0].metadata.output_tag, 'b', 'cell 1 has the correct output_tag');
    });

    this.then(function() {
        this.evaluate(function () {
            var cell = Jupyter.notebook.get_cell(0);
            cell.set_text('a=b+3');
            cell.execute();
        });
    });

    this.wait_for_output(0);

    this.then(function () {
        var outputs = get_outputs(0);
        this.test.assertEquals(outputs[0].output_type, 'error', 'Trying to initiate a Cyclical Call results in an error');
        this.test.assertEquals(outputs[0].ename, 'CyclicalCallError', 'Trying to force a CyclicalCall results in the correct type of error');
    });

    this.then(function() {
        this.evaluate(function () {
            Jupyter.notebook.insert_cell_at_index("code", 3);
            var cell = Jupyter.notebook.get_cell(3);
            cell.set_text('3');
            cell.execute();
        });
    });

    this.wait_for_output(3);

    this.then(function () {
        var outputs = get_outputs(3);
        this.test.assertEquals(outputs.length, 1, 'cell 3 has the right number of outputs');
        this.test.assertEquals(outputs[0].output_type, 'execute_result', 'cell 3 produces the correct type of output');
        this.test.assertEquals(outputs[0].data['text/plain'], '3', 'cell 3 produces the correct output');
    });

    this.then(function() {
        this.evaluate(function () {
            Jupyter.notebook.insert_cell_at_index("code", 4);
            var cell = Jupyter.notebook.get_cell(4);
            var uuid = Jupyter.notebook.get_cell(3).uuid;
            cell.set_text('Out[' + uuid + ']+3');
            cell.execute();
        });
    });

    this.wait_for_output(4);

    this.then(function () {
        var outputs = get_outputs(4);
        this.test.assertEquals(outputs.length, 1, 'cell 4 has the right number of outputs');
        this.test.assertEquals(outputs[0].output_type, 'execute_result', 'cell 4 produces the correct type of output');
        this.test.assertEquals(outputs[0].data['text/plain'], '6', 'cell 4 produces the correct output');
    });

    this.then(function() {
        this.evaluate(function () {
            var cell = Jupyter.notebook.get_cell(3);
            var uuid = Jupyter.notebook.get_cell(4).uuid;
            cell.set_text('3+Out[' + uuid + ']');
            cell.execute();
        });
    });

    this.wait_for_output(3);

    this.then(function () {
        var outputs = get_outputs(3);
        this.test.assertEquals(outputs[0].output_type, 'error', 'Trying to initiate a Cyclical Call results in an error');
        this.test.assertEquals(outputs[0].ename, 'CyclicalCallError', 'Trying to force a CyclicalCall results in the correct type of error');
    });

});
