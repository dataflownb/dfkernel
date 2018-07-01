//
// Test output tags
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

    var uuid = '';

    this.evaluate(function () {
        Jupyter.notebook.insert_cell_at_index("code", 0);
        var cell = Jupyter.notebook.get_cell(0);
        uuid = cell.uuid;
        cell.set_text('a=3');
        cell.execute();
    });

    this.wait_for_output(0);

    this.then(function () {
        var outputs = get_outputs(0);
        this.test.assertEquals(outputs.length, 1, 'cell 0 has the right number of outputs');
        this.test.assertEquals(outputs[0].data['text/plain'], '3', 'cell 0 produces the correct output');
        this.test.assertEquals(outputs[0].metadata.output_tag, 'a', 'cell 0 has the correct output_tag');
    });

    this.evaluate(function () {
        Jupyter.notebook.insert_cell_at_index("code", 1);
        var cell = Jupyter.notebook.get_cell(1);
        cell.set_text('print(a)');
        cell.execute();
    });

    this.wait_for_output(1);

    this.then(function () {
        var result = this.get_output_cell(1);
        this.test.assertEquals(result.text, '3\n', 'cell 1 prints the correct output');
    });


    this.evaluate(function () {
        Jupyter.notebook.insert_cell_at_index("code", 2);
        var cell = Jupyter.notebook.get_cell(2);
        cell.set_text('b=3\na,b');
        cell.execute();
    });

    this.wait_for_output(2);

    this.then(function () {
        var outputs = get_outputs(2);
        this.test.assertEquals(outputs.length, 1, 'cell 2 has the right number of outputs');
        this.test.assertEquals(outputs[0].data['text/plain'], '(3, 3)', 'cell 2 produces the correct output');
    });

    this.evaluate(function () {
        Jupyter.notebook.insert_cell_at_index("code", 3);
        var cell = Jupyter.notebook.get_cell(3);
        console.log('Out[' + uuid + ']');
        cell.set_text('Out[' + uuid + ']');
        cell.execute();
    });


    this.wait_for_output(3);

    this.then(function () {
        var outputs = get_outputs(3);
        this.test.assertEquals(outputs.length, 1, 'cell 3 has the right number of outputs');
        this.test.assertEquals(outputs[0].output_type, 'execute_result', 'cell 3 produces the correct type of output');
        this.test.assertEquals(outputs[0].data['text/plain'], '3', 'cell 3 produces the correct output');
    });

    this.evaluate(function () {
        Jupyter.notebook.insert_cell_at_index("code", 4);
        var cell = Jupyter.notebook.get_cell(4);
        cell.set_text('a = 5');
        cell.execute();
    });

    this.wait_for_output(4);


    this.then(function () {
        var outputs = get_outputs(4);
        this.test.assertEquals(outputs[0].output_type, 'error', 'Trying to reassign results in an error');
        this.test.assertEquals(outputs[0].ename, 'DuplicateNameError', 'Trying to reassign results in the correct type of error');
    });


});
