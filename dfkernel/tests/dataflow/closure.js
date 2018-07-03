//
// Test closures to make sure inner variables work and provide consistent output
//
casper.notebook_test(function () {

    function get_outputs(cell_idx) {
        var outputs_json = casper.evaluate(function (cell_idx) {
            var cell = Jupyter.notebook.get_cell(cell_idx);
            return JSON.stringify(cell.output_area.outputs);
        }, {cell_idx: cell_idx});
        return JSON.parse(outputs_json);
    }

    this.evaluate(function () {
        Jupyter.notebook.insert_cell_at_index("code", 0);
        var cell = Jupyter.notebook.get_cell(0);
        cell.set_text('i = 2\ndef j():\n\treturn i\nj');
        cell.execute();
    });

    this.wait_for_output(0);

    this.evaluate(function () {
        Jupyter.notebook.insert_cell_at_index("code", 1);
        var cell = Jupyter.notebook.get_cell(1);
        cell.set_text('print(j())');
        cell.execute();
        Jupyter.notebook.insert_cell_at_index("code", 2);
        var cell = Jupyter.notebook.get_cell(2);
        cell.set_text('j()');
        cell.execute();
    });

    this.wait_for_output(1);
    this.wait_for_output(2);


    this.then(function () {
        var result = this.get_output_cell(1);
        this.test.assertEquals(result.text, '2\n', 'closure produces correct result');
        var outputs = get_outputs(2);
        this.test.assertEquals(outputs.length, 1, 'cell 2 has the right number of outputs');
        this.test.assertEquals(outputs[0].data['text/plain'], '2', 'cell 2 produces the correct output');
    });


    this.evaluate(function () {
        Jupyter.notebook.insert_cell_at_index("code", 3);
        var cell = Jupyter.notebook.get_cell(3);
        cell.set_text('i = 5');
        cell.execute();
    });

    this.wait_for_output(3);

    this.evaluate(function () {
        var cell = Jupyter.notebook.get_cell(1);
        cell.execute();
        var cell = Jupyter.notebook.get_cell(2);
        cell.execute();
    });

    this.wait_for_output(1);
    this.wait_for_output(2);

    this.then(function () {
        var result = this.get_output_cell(1);
        this.test.assertEquals(result.text, '2\n', 'closure produces correct result after re-execution');
        var outputs = get_outputs(2);
        this.test.assertEquals(outputs.length, 1, 'cell 2 has the right number of outputs after re-execution');
        this.test.assertEquals(outputs[0].data['text/plain'], '2', 'cell 2 produces the correct output after re-execution');
    });

});
