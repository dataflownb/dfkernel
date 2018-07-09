//
// Test recursive execution and stale states
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

    this.then(function(){

        this.evaluate(function () {
        Jupyter.notebook.insert_cell_at_index("code", 0);
        var cell = Jupyter.notebook.get_cell(0);
        cell.set_text('a=3');
        cell.execute();
        });

        this.wait_for_output(0);

        this.evaluate(function () {
            Jupyter.notebook.insert_cell_at_index("code", 1);
            var cell = Jupyter.notebook.get_cell(1);
            cell.set_text('b=a+6');
            cell.execute();
        });

        this.wait_for_output(1);

        this.then(function () {
            var outputs = get_outputs(1);
            this.test.assertEquals(outputs.length, 1, 'cell 1 has the right number of outputs');
            this.test.assertEquals(outputs[0].data['text/plain'], '9', 'cell 1 produces the correct output');
        });

        this.evaluate(function () {
            Jupyter.notebook.insert_cell_at_index("code", 2);
            var cell = Jupyter.notebook.get_cell(2);
            var uuid = Jupyter.notebook.get_cell(0).uuid;
            cell.set_text('c=Out['+uuid+']+4');
            cell.execute();
        });

        this.wait_for_output(2);

        this.then(function () {
            var outputs = get_outputs(2);
            this.test.assertEquals(outputs.length, 1, 'cell 2 has the right number of outputs');
            this.test.assertEquals(outputs[0].data['text/plain'], '7', 'cell 2 produces the correct output');
        });

        this.evaluate(function () {
            Jupyter.notebook.insert_cell_at_index("code", 3);
            var cell = Jupyter.notebook.get_cell(3);
            cell.set_text('b+c');
            cell.execute();
        });

        this.wait_for_output(3);

        this.then(function () {
            var outputs = get_outputs(3);
            this.test.assertEquals(outputs.length, 1, 'cell 3 has the right number of outputs');
            this.test.assertEquals(outputs[0].output_type, 'execute_result', 'cell 3 produces the correct type of output');
            this.test.assertEquals(outputs[0].data['text/plain'], '16', 'cell 3 produces the correct output');
        });
    });

    //Have to wrap these seperately so that all other cells get executed first
    this.then(function(){
        this.evaluate(function () {
            var cell = Jupyter.notebook.get_cell(0);
            cell.set_text('a = 5');
            cell = Jupyter.notebook.get_cell(3);
            cell.execute();
        });
        this.wait_for_output(3);

        this.then(function () {
            var outputs = get_outputs(1);
            this.test.assertEquals(outputs.length, 1, 'cell 2 has the right number of outputs');
            this.test.assertEquals(outputs[0].data['text/plain'], '11', 'cell 2 produces the correct output');
            var outputs = get_outputs(2);
            this.test.assertEquals(outputs.length, 1, 'cell 2 has the right number of outputs');
            this.test.assertEquals(outputs[0].data['text/plain'], '9', 'cell 2 produces the correct output');
            var outputs = get_outputs(3);
            this.test.assertEquals(outputs.length, 1, 'cell 3 has the right number of outputs');
            this.test.assertEquals(outputs[0].output_type, 'execute_result', 'cell 3 produces the correct type of output');
            this.test.assertEquals(outputs[0].data['text/plain'], '20', 'cell 3 produces the correct output');
        });
    });

});
