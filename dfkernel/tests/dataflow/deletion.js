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

    function get_cell_type(cell_idx) {
        return casper.evaluate(function (cell_idx) {
            var cell = Jupyter.notebook.get_cell(cell_idx);
            return cell.cell_type;
        }, {cell_idx: cell_idx});
    }

    this.wait_for_kernel_ready();

    /*
    //First Test:
    //Multi tags redefinitions
    */
    this.then(function () {

        this.evaluate(function () {
            Jupyter.notebook.insert_cell_at_index("code", 0);
            var cell = Jupyter.notebook.get_cell(0);
            cell.set_text('c,d = 5,6');
            cell.execute();
        });

        this.wait_for_output(0);

    });

    this.then(function () {
        this.evaluate(function () {
            Jupyter.notebook.delete_cell(0);
        });

        this.wait_for_idle();

        this.then(function () {
            var cell_type = get_cell_type(0);
            this.test.assertEquals(cell_type, 'raw', 'cell 0 is a raw cell after cell deletion');
        });

    });


    this.then(function () {
        this.evaluate(function () {
            Jupyter.notebook.insert_cell_at_index("code", 1);
            var cell = Jupyter.notebook.get_cell(1);
            cell.set_text('c,d=1,2');
            cell.execute();
        });

        this.wait_for_output(0);

        this.then(function () {
            var outputs = get_outputs(0);
            var cell_type = get_cell_type(0);
            this.test.assertEquals(cell_type, 'code', 'red horizontal line disappear after cell execition, cell 0 is a code cell after cell execution');
            this.test.assertEquals(outputs[0].data['text/plain'], '1', 'cell 0 produces the correct first output, cell deletion works successfully');
            this.test.assertEquals(outputs[0].metadata.output_tag, 'c', 'cell 0 has the correct first output_tag');
            this.test.assertEquals(outputs[1].data['text/plain'], '2', 'cell 0 produces the correct second output, cell deletion works successfully');
            this.test.assertEquals(outputs[1].metadata.output_tag, 'd', 'cell 0 has the correct second output_tag');

        });
    });




    /*
    //Second test
    //Single Tag redefinition
    */

    this.then(function () {
        this.evaluate(function () {
            Jupyter.notebook.insert_cell_at_index("code", 2);
            var cell = Jupyter.notebook.get_cell(2);
            cell.set_text('e = 5');
            cell.execute();
        });

        this.wait_for_output(2);
    });


    this.then(function () {
        this.evaluate(function () {
            Jupyter.notebook.delete_cell(2);
        });

        this.wait_for_idle();

        this.then(function () {
            var cell_type = get_cell_type(2);
            this.test.assertEquals(cell_type, 'raw', 'cell 2 is a raw cell after cell deletion');
        });

    });

    this.then(function () {
        this.evaluate(function () {
            Jupyter.notebook.insert_cell_at_index("code", 2);
            var cell = Jupyter.notebook.get_cell(2);
            cell.set_text('e=10');
            cell.execute();
        });

        this.wait_for_output(2);

        this.then(function () {
            var outputs = get_outputs(2);
            var cell_type = get_cell_type(2);
            this.test.assertEquals(cell_type, 'code', 'red horizontal line disappear after cell execition, cell 2 is a code cell after cell execution');
            this.test.assertEquals(outputs[0].data['text/plain'], '10', 'cell 2 produces the correct output, cell deletion works successfully');
            this.test.assertEquals(outputs[0].metadata.output_tag, 'e', 'cell 2 has the correct output_tag');
        });
    });

});
 
