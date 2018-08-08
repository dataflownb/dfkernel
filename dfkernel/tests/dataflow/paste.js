//
// Test that the paste function only copies outputs as needed
// Also tests that when a paste is performed that we get rid of
// any references to the original cell in the undelete stack
//
casper.notebook_test(function () {

    function get_outputs(cell_idx) {
        var outputs_json = casper.evaluate(function (cell_idx) {
            var cell = Jupyter.notebook.get_cell(cell_idx);
            return JSON.stringify(cell.output_area.outputs);
        }, {cell_idx: cell_idx});
        return JSON.parse(outputs_json);
    }


    function get_undelete_stack_len(){
        var undel_stack = casper.evaluate(function()
        {
           var undelete_stack = Jupyter.notebook.undelete_backup_stack;
           return undelete_stack.length;
        });
        return undel_stack;
    }

    function get_uuid(cell_idx) {
        var output = casper.evaluate(function (cell_idx) {
            var cell = Jupyter.notebook.get_cell(cell_idx);
            return cell.uuid;
        }, {cell_idx: cell_idx});
        return output;
    }


    this.wait_for_kernel_ready();

    function grab_original_uuid(){
        uuid  = casper.evaluate(function () {
            Jupyter.notebook.insert_cell_at_index("code", 0);
            var cell = Jupyter.notebook.get_cell(0);
            cell.set_text('a=3');
            cell.execute();
            return cell.uuid;
        });
        return uuid;
    }

    this.then(function () {
        //We have to grab the original uuid to perform tests
        var uuid = grab_original_uuid();

    });

    this.wait_for_output(0);

    this.then(function () {
        var outputs = get_outputs(0);
        this.test.assertEquals(outputs.length, 1, 'cell 0 has the right number of outputs');
        this.test.assertEquals(outputs[0].data['text/plain'], '3', 'cell 0 produces the correct output');
        this.test.assertEquals(outputs[0].metadata.output_tag, 'a', 'cell 0 has the correct output_tag');
    });

    this.then(function () {
        this.evaluate(function () {
            Jupyter.notebook.select(0);
            Jupyter.notebook.copy_cell();
            Jupyter.notebook.paste_cell_below();
        });
    });
    this.then(function () {

        this.then(function () {
            var outputs = get_outputs(1);
            this.test.assertEquals(outputs.length, 0, 'cell 1 has the right number of outputs');
            var text = this.get_cell_text(1);
            var pasteuuid = get_uuid(1);
            this.test.assertNotEquals(pasteuuid, uuid, 'cell 1 has a different uuid');
            this.test.assertEquals(text,"a=3","cell 1 contains the correct text")
        });

        this.then(function () {
            this.evaluate(function () {
                Jupyter.notebook.select(0);
                Jupyter.notebook.delete_cell();
            });
        });

        this.then(function() {
            var undel_stack_len = get_undelete_stack_len();
            this.test.assertEquals(undel_stack_len,1,"The undelete stack currently contains the deleted cell");
        });

        this.then(function(){
            this.evaluate(function(){
                Jupyter.notebook.paste_cell_below();
                Jupyter.notebook.paste_cell_below();
            });
        });


        this.then(function () {
            var outputs = get_outputs(1);
            var pasteuuid = get_uuid(1);
            var text = this.get_cell_text(1);
            var undel_stack_len = get_undelete_stack_len();
            this.test.assertEquals(undel_stack_len,0,"The undelete stack reference to the deleted cell is gone");
            this.test.assertEquals(text,"a=3","cell 1 contains the correct text");
            this.test.assertEquals(pasteuuid, uuid, 'after deletion cell 1 retains the same uuid');
            this.test.assertEquals(outputs.length, 1, 'after deletion cell 1 has the right number of outputs');
            this.test.assertEquals(outputs[0].data['text/plain'], '3', 'cell 1 produces the correct output');
            this.test.assertEquals(outputs[0].metadata.output_tag, 'a', 'cell 1 has the correct output_tag');
            var outputs = get_outputs(2);
            var pasteuuid = get_uuid(2);
            this.test.assertNotEquals(pasteuuid, uuid, 'cell 2 has a different uuid');
            this.test.assertEquals(outputs.length, 0, 'cell 2 has the right number of outputs');
            var text = this.get_cell_text(2);
            this.test.assertEquals(text,"a=3","cell 2 contains the correct text")
        });
    });
});
