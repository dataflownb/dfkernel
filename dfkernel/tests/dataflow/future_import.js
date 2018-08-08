//
// Test from __future__ imports
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

    this.evaluate(function () {
        Jupyter.notebook.insert_cell_at_index("code", 0);
        var cell = Jupyter.notebook.get_cell(0);
        cell.set_text('from __future__ import print_function\n' +
            'import sys');
        cell.execute();
    });

    this.wait_for_output(0);

    this.then(function () {
        var outputs = get_outputs(0);
        this.test.assertEquals(outputs.length, 1, 'cell 0 has the right number of outputs');
        this.test.assertEquals(outputs[0].metadata.output_tag, 'sys', 'cell 0 has the correct output_tag');
    });

    this.evaluate(function () {
        Jupyter.notebook.insert_cell_at_index("code", 1);
        var cell = Jupyter.notebook.get_cell(1);
        cell.set_text('from __future__ import print_function\n' +
            'from __future__ import print_function\n' +
            'import io\n' +
            'import time');
        cell.execute();
    });

    this.wait_for_output(1);

    this.then(function () {
        var outputs = get_outputs(1);
        this.test.assertEquals(outputs.length, 2, 'cell 1 has the right number of outputs');
    });


});
