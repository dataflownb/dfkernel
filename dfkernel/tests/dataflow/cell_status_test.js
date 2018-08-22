//
// Test cells with deletion
//

casper.notebook_test(function () {

    function get_cell_status(cell_idx) {
        return casper.evaluate(function (cell_idx) {
            var cell = Jupyter.notebook.get_cell(cell_idx);
            return cell.metadata.cell_status;
        }, {cell_idx: cell_idx});
    }

    this.wait_for_kernel_ready();

    this.then(function() {
        this.evaluate(function () {
            Jupyter.notebook.insert_cell_at_index("code", 1);
            var cell = Jupyter.notebook.get_cell(1);
            cell.set_text('a= 1');
            cell.execute();
        });
    });

    this.wait_for_output(1);

    this.then(function() {
        this.evaluate(function () {
            Jupyter.notebook.insert_cell_at_index("code", 2);
            var cell = Jupyter.notebook.get_cell(2);
            cell.set_text('a= 2');
            cell.execute();
        });
    });

    this.wait_for_output(2);

    this.then(function() {
        this.evaluate(function () {
            Jupyter.notebook.insert_cell_at_index("code", 3);
            var cell = Jupyter.notebook.get_cell(3);
            cell.set_text('b= a+ 3');
            cell.execute();
        });
    });

    this.wait_for_output(3);

    this.then(function() {
        this.evaluate(function () {
            Jupyter.notebook.insert_cell_at_index("code", 4);
            var cell = Jupyter.notebook.get_cell(4);
            cell.set_text('c= b + 4');
            cell.execute();
        });
    });

    this.wait_for_output(4);

    this.then(function () {
        var cell_status0 = get_cell_status(0);
        var cell_status1 = get_cell_status(1);
        var cell_status2 = get_cell_status(2);
        var cell_status3 = get_cell_status(3);
        var cell_status4 = get_cell_status(4);
        this.test.assertEquals(cell_status0, 'new', 'cell 0 has the correct cell status after execution');
        this.test.assertEquals(cell_status1, 'success', 'cell 1 has the correct cell status after execution');
        this.test.assertEquals(cell_status2, 'error', 'cell 2 has the correct cell status after execution');
        this.test.assertEquals(cell_status3, 'success', 'cell 3 has the correct cell status after execution');
        this.test.assertEquals(cell_status4, 'success', 'cell 4 has the correct cell status after execution');
    });

    /*
    //First Test:
    //cell status change after being edited
    */
    this.then(function () {

        this.evaluate(function () {
            var cell0 = Jupyter.notebook.get_cell(0);
            var cell1 = Jupyter.notebook.get_cell(1);
            var cell2 = Jupyter.notebook.get_cell(2);
            cell0.set_text('d= 9');
            cell1.set_text('a= 5');
            cell2.set_text('b= 6');
        });

        this.then(function () {
            var cell_status0 = get_cell_status(0);
            var cell_status1 = get_cell_status(1);
            var cell_status2 = get_cell_status(2);
            var cell_status3 = get_cell_status(3);
            var cell_status4 = get_cell_status(4);
            this.test.assertEquals(cell_status0, 'edited-new', 'cell 0 has the correct cell status after edit');
            this.test.assertEquals(cell_status1, 'edited-success', 'cell 1 has the correct cell status after edit');
            this.test.assertEquals(cell_status2, 'edited-error', 'cell 2 has the correct cell status after edit');
            this.test.assertEquals(cell_status3, 'edited-success', 'cell 3 has the correct cell status after edit');
            this.test.assertEquals(cell_status4, 'edited-success', 'cell 4 has the correct cell status after edit');
        });
    });

    /*
    //First Test:
    //cell status change after being unedited
    */
    this.then(function () {

        this.evaluate(function () {
            var cell0 = Jupyter.notebook.get_cell(0);
            var cell1 = Jupyter.notebook.get_cell(1);
            var cell2 = Jupyter.notebook.get_cell(2);
            cell0.set_text('');
            cell1.set_text('a= 1');
            cell2.set_text('a= 2');
        });

        this.then(function () {
            var cell_status0 = get_cell_status(0);
            var cell_status1 = get_cell_status(1);
            var cell_status2 = get_cell_status(2);
            var cell_status3 = get_cell_status(3);
            var cell_status4 = get_cell_status(4);
            this.test.assertEquals(cell_status0, 'new', 'cell 0 has the correct cell status after edit');
            this.test.assertEquals(cell_status1, 'success', 'cell 1 has the correct cell status after un-edit');
            this.test.assertEquals(cell_status2, 'error', 'cell 2 has the correct cell status after un-edit');
            this.test.assertEquals(cell_status3, 'success', 'cell 3 has the correct cell status after un-edit');
            this.test.assertEquals(cell_status4, 'success', 'cell 4 has the correct cell status after un-edit');
        });
    });

});

