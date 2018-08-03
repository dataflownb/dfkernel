//
// Test cells with deletion
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
        Jupyter.notebook.insert_cell_at_index("code", 1);
        var cell0 = Jupyter.notebook.get_cell(0);
        var cell1 = Jupyter.notebook.get_cell(1);
        cell0.set_text('c,d = 5,6');
        cell1.set_text('a,b= 3,4');
        cell0.execute();
        cell1.execute();
    });

    this.wait_for_output(0);
    this.wait_for_output(1);

    this.then(function () {
        this.evaluate(function () {
            Jupyter.notebook.delete_cell(0);
            Jupyter.notebook.insert_cell_at_index("code", 1);
            var cell = Jupyter.notebook.get_cell(1);
            cell.set_text('c,d=1,2');
            cell.execute();
        });
    });

    this.wait_for_output(1);

    this.then(function () {
        var outputs = get_outputs(1);
        this.test.assertEquals(outputs[0].data['text/plain'], '1', 'cell 2 produces the correct output, cell deletion works successfully');
        this.test.assertEquals(outputs[0].metadata.output_tag, 'c', 'cell 2 has the correct output_tag');

    });

    this.evaluate(function () {
        Jupyter.notebook.insert_cell_at_index("code", 2);
        var cell = Jupyter.notebook.get_cell(2);
        cell.set_text('e = 5');
        cell.execute();
    });

    this.wait_for_output(2);

    this.then(function () {
        this.evaluate(function () {
            Jupyter.notebook.delete_cell(2);
            Jupyter.notebook.insert_cell_at_index("code", 2);
            var cell = Jupyter.notebook.get_cell(2);
            cell.set_text('e=10');
            cell.execute();
        });
    });

    this.wait_for_output(2);

    this.then(function () {
        var outputs = get_outputs(2);
        this.test.assertEquals(outputs[0].data['text/plain'], '10', 'cell 2 produces the correct output, cell deletion works successfully');
        this.test.assertEquals(outputs[0].metadata.output_tag, 'e', 'cell 2 has the correct output_tag');

    });    
});
 
