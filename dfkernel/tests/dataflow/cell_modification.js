//
// Test cells modification
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

    //By assigning this here we speed up the test slightly by not requiring a later this.then block
    var uuid = '';

    this.evaluate(function () {
        Jupyter.notebook.insert_cell_at_index("code", 0);
        var cell = Jupyter.notebook.get_cell(0);
        uuid = cell.uuid;
        cell.set_text('c,d = 5,6');
        cell.execute();
    });

    this.wait_for_output(0);

    this.then(function () {
        var outputs = get_outputs(0);
        this.test.assertEquals(outputs.length, 2, 'cell 0 has the right number of outputs');
        this.test.assertEquals(outputs[0].data['text/plain'], '5', 'cell 0 produces the correct first output');
        this.test.assertEquals(outputs[0].metadata.output_tag, 'c', 'cell 0 has the correct first output_tag');
        this.test.assertEquals(outputs[1].data['text/plain'], '6', 'cell 0 produces the correct second output');
        this.test.assertEquals(outputs[1].metadata.output_tag, 'd', 'cell 0 has the correct second output_tag');
    });

    this.then(function () {
        this.evaluate(function () {
            var cell = Jupyter.notebook.get_cell(0);
            uuid = cell.uuid;
            cell.set_text('a,c,d = 4,5,6');
            cell.execute();
        });
    });

    this.wait_for_output(0);

    this.then(function () {
        var outputs = get_outputs(0);
        this.test.assertEquals(outputs.length, 3, 'cell 0 has the right number of outputs');
        this.test.assertEquals(outputs[0].data['text/plain'], '4', 'cell 0 produces the correct first output');
        this.test.assertEquals(outputs[0].metadata.output_tag, 'a', 'cell 0 has the correct first output_tag');
        this.test.assertEquals(outputs[1].data['text/plain'], '5', 'cell 0 produces the correct second output');
        this.test.assertEquals(outputs[1].metadata.output_tag, 'c', 'cell 0 has the correct second output_tag');
        this.test.assertEquals(outputs[2].data['text/plain'], '6', 'cell 0 produces the correct third output');
        this.test.assertEquals(outputs[2].metadata.output_tag, 'd', 'cell 0 has the correct third output_tag');
    });

    this.evaluate(function () {
        Jupyter.notebook.insert_cell_at_index("code", 1);
        var cell = Jupyter.notebook.get_cell(1);
        cell.set_text('e,f= 1,2');
        cell.execute();
        });

    this.wait_for_output(1);

    this.then(function () {
        var outputs = get_outputs(1);
        this.test.assertEquals(outputs.length, 2, 'cell 1 has the right number of outputs');
        this.test.assertEquals(outputs[0].data['text/plain'], '1', 'cell 1 produces the correct first output');
        this.test.assertEquals(outputs[0].metadata.output_tag, 'e', 'cell 1 has the correct first output_tag');
        this.test.assertEquals(outputs[1].data['text/plain'], '2', 'cell 1 produces the correct second output');
        this.test.assertEquals(outputs[1].metadata.output_tag, 'f', 'cell 1 has the correct second output_tag');
    });

    this.then(function () {
        this.evaluate(function () {
            var cell = Jupyter.notebook.get_cell(1);
            cell.set_text('e,f=1,2\ne,f,a');
            cell.execute();
            });
    });

    this.wait_for_output(1);

    this.then(function () {
        var outputs = get_outputs(1);
        this.test.assertEquals(outputs.length, 1, 'cell 1 has the right number of outputs');
        this.test.assertEquals(outputs[0].data['text/plain'], '(1, 2, 4)', 'cell 1 produces the correct output');
        this.test.assertEquals(outputs[0].output_type, 'execute_result', 'cell 1 produces the correct type of output');

    });


});
