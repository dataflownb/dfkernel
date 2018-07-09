//
// Test DataflowHistoryManager functionality
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
            cell.set_text("len(_ns['Out'])");
            cell.execute();
        });

        this.wait_for_output(1);

        this.then(function () {
            var outputs = get_outputs(1);
            this.test.assertEquals(outputs[0].data['text/plain'], '3', 'cell 1 produces the correct output');
        });
    });

    this.then(function () {
        this.evaluate(function () {
            Jupyter.notebook.insert_cell_at_index("code", 2);
            var cell = Jupyter.notebook.get_cell(2);
            cell.set_text('"aaaaaa" in _ns["Out"]');
            cell.execute();
        });

        this.wait_for_output(2);

        this.then(function () {
            var outputs = get_outputs(2);
            this.test.assertEquals(outputs[0].data['text/plain'], 'True', 'cell 1 produces the correct output');
        });
    });

    this.then(function () {
        this.evaluate(function () {
            Jupyter.notebook.insert_cell_at_index("code", 3);
            var cell = Jupyter.notebook.get_cell(3);
            cell.set_text('len(_ns["Out"])');
            cell.execute();
        });

        this.wait_for_output(3);

        this.then(function () {
            var outputs = get_outputs(3);
            this.test.assertEquals(outputs[0].data['text/plain'], '5', 'cell 3 produces the correct output');
        });
    });
});
