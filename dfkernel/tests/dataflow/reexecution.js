//
// Test consistent behavior on cell re-execution
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
    this.then(function () {
            this.evaluate(function () {
                Jupyter.notebook.insert_cell_at_index("code", 0);
                var cell = Jupyter.notebook.get_cell(0);
                cell.set_text('a = 2');
                cell.execute();
            });
            this.wait_for_output(0);

            this.then(function () {
                var outputs = get_outputs(0);
                this.test.assertEquals(outputs.length, 1, 'cell 2 has the right number of outputs');
                this.test.assertEquals(outputs[0].data['text/plain'], '2', 'cell 1 contains the same result');
            });
    });

    this.then(function () {
        this.evaluate(function () {
            var cell = Jupyter.notebook.get_cell(0);
            cell.set_text('a = 3');
            cell.execute();
        });

        this.wait_for_output(0);

        this.then(function () {
            var outputs = get_outputs(0);
            this.test.assertEquals(outputs.length, 1, 'cell 2 has the right number of outputs');
            this.test.assertEquals(outputs[0].data['text/plain'], '3', 'cell 1 contains the same result');
        });
    });

});
