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
            Jupyter.notebook.insert_cell_at_index("code",0);
            var cell = Jupyter.notebook.get_cell(0);
            cell.set_text('from collections import OrderedDict');
            cell.execute();
        });

        this.wait_for_output(0);
    });

    this.then(function() {

        this.evaluate(function () {
            Jupyter.notebook.insert_cell_at_index("code", 1);
            var cell = Jupyter.notebook.get_cell(1);
            cell.set_text('%split_out OrderedDict([("a",3),("b",4)])');
            cell.execute();
        });

        this.wait_for_output(1);

        this.then(function () {
            var outputs = get_outputs(1);
            this.test.assertEquals(outputs.length, 2, 'cell 0 has the right number of outputs');
            this.test.assertEquals(outputs[0].metadata.output_tag, 'a', 'cell 0 has the correct first output_tag');
            this.test.assertEquals(outputs[0].data['text/plain'], '3', 'cell 0 produces the correct output');
            this.test.assertEquals(outputs[1].metadata.output_tag, 'b', 'cell 0 has the correct first output_tag');
            this.test.assertEquals(outputs[1].data['text/plain'], '4', 'cell 0 produces the correct output');
        });


        this.evaluate(function () {
            Jupyter.notebook.insert_cell_at_index("code", 2);
            var cell = Jupyter.notebook.get_cell(2);
            cell.set_text('dic=OrderedDict([("c",3),("d",4)])');
            cell.execute();
        });

        this.wait_for_output(2);

        this.then(function () {
            var outputs = get_outputs(2);
            this.test.assertEquals(outputs.length, 1, 'cell 1 has the right number of outputs');
            this.test.assertEquals(outputs[0].data['text/plain'], "OrderedDict([('c', 3), ('d', 4)])", 'cell 1 produces the correct output');
        });

        this.evaluate(function () {
            Jupyter.notebook.insert_cell_at_index("code", 3);
            var cell = Jupyter.notebook.get_cell(3);
            cell.set_text('%split_out dic');
            cell.execute();
        });

        this.wait_for_output(3);

        this.then(function () {
            var outputs = get_outputs(3);
            this.test.assertEquals(outputs.length, 2, 'cell 2 has the right number of outputs');
            this.test.assertEquals(outputs[0].metadata.output_tag, 'c', 'cell 2 has the correct first output_tag');
            this.test.assertEquals(outputs[0].data['text/plain'], '3', 'cell 2 produces the correct output');
            this.test.assertEquals(outputs[1].metadata.output_tag, 'd', 'cell 2 has the correct first output_tag');
            this.test.assertEquals(outputs[1].data['text/plain'], '4', 'cell 2 produces the correct output');
        });
    });
});
