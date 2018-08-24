//
// Test buffering for execution requests.
//
casper.notebook_test(function () {
    this.then(function() {
      // make sure there are at least three cells for the tests below.
      this.append_cell();
      this.append_cell();
      this.append_cell();
    })

    this.thenEvaluate(function () {
        IPython.notebook.kernel.stop_channels();
        var cell = IPython.notebook.get_cell(0);
        cell.set_text('a=10; print(a)');
        IPython.notebook.execute_cells([0]);
        IPython.notebook.kernel.reconnect(1);
    });

    this.wait_for_output(0);

    this.then(function () {
        var result = this.get_output_cell(0);
        this.test.assertEquals(result.text, '10\n', 'kernels buffer messages if connection is down');
    });

    this.thenEvaluate(function () {
        var cell = IPython.notebook.get_cell(0);
        var cellplus = IPython.notebook.get_cell(1);
        var cellprint = IPython.notebook.get_cell(2);
        var finalcell = IPython.notebook.get_cell(3);
        cell.set_text('k=1');
        cellplus.set_text('p=2*j+1');
        cellprint.set_text('j=k+1');

        IPython.notebook.kernel.stop_channels();

        // Repeated execution of cell queued up in the kernel executes
        // each execution request in order.
        IPython.notebook.execute_cells([0]);
        IPython.notebook.execute_cells([2]);
        IPython.notebook.execute_cells([1]);
        cellplus.set_text('p=2*j+3');
        IPython.notebook.execute_cells([1]);
        cellplus.set_text('p=2*j+5');
        IPython.notebook.execute_cells([1]);
        finalcell.set_text('print(p)');
        IPython.notebook.execute_cells([3]);


        IPython.notebook.kernel.reconnect(1);
    });

    this.wait_for_output(3);

    this.then(function () {
        var result = this.get_output_cell(3);
        this.test.assertEquals(result.text, '9\n', 'kernels send buffered messages in order');
    });
});
