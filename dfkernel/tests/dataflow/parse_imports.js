//
// Test autoparsing out libaries with a number of test cases
//
casper.notebook_test(function () {

    function get_outputs(cell_idx) {
        var outputs_json = casper.evaluate(function (cell_idx) {
            var cell = Jupyter.notebook.get_cell(cell_idx);
            return JSON.stringify(cell.output_area.outputs);
        }, {cell_idx: cell_idx});
        return JSON.parse(outputs_json);
    }

    //Test with single named output
    this.then(function() {
       this.then(function(){

          this.wait_for_kernel_ready();

          // ensures kernel is running before test
        this.then(function () {
            this.test.assert(this.kernel_running(), 'Start single numeric test');
        });

          this.then(function () {
            this.evaluate(function () {
                Jupyter.notebook.insert_cell_at_index("code", 0);
                var cell = Jupyter.notebook.get_cell(0);
                cell.set_text('import sys, os\na = 6');
                cell.execute();
            });
        });

        this.wait_for_output(0);

        this.then(function () {
            var outputs = get_outputs(0);
            this.test.assertEquals(outputs.length, 3, 'cell 0 has the right number of outputs');
            this.test.assertEquals(outputs[2].data['text/plain'], '6', 'cell 0 produces the correct output');
        });


        this.then(function () {
            this.evaluate(function () {
                Jupyter.notebook.insert_cell_at_index("code", 1);
                var cell = Jupyter.notebook.get_cell(1);
                var uuid = Jupyter.notebook.get_cell(0).uuid;
                cell.set_text('Out[' + uuid + ']');
                cell.execute();
            });
        });

        this.wait_for_output(1);

        this.then(function () {
            var outputs = get_outputs(1);
            this.test.assertEquals(outputs.length, 1, 'cell 1 has the right number of outputs');
            this.test.assertEquals(outputs[0].data['text/plain'], '6', 'cell 1 produces the correct output');
        });
       });

    });

    //Single numeric test
    this.then(function() {
       this.then(function(){
          this.evaluate(function () {
            Jupyter.notebook.clear_all_output();
            Jupyter.notebook.kernel.restart();
          });

          this.wait_for_kernel_ready();

          // ensures kernel is running before test
        this.then(function () {
            this.test.assert(this.kernel_running(), 'Start single numeric test');
        });

          this.then(function () {
            this.evaluate(function () {
                var cell = Jupyter.notebook.get_cell(0);
                cell.set_text('import sys, os\n5');
                cell.execute();
            });
        });

        this.wait_for_output(0);

        this.then(function () {
            var outputs = get_outputs(0);
            this.test.assertEquals(outputs.length, 3, 'cell 0 has the right number of outputs');
            this.test.assertEquals(outputs[2].data['text/plain'], '5', 'cell 0 produces the correct output');
        });


        this.then(function () {
            this.evaluate(function () {
                var cell = Jupyter.notebook.get_cell(1);
                var uuid = Jupyter.notebook.get_cell(0).uuid;
                cell.set_text('Out[' + uuid + ']');
                cell.execute();
            });
        });

        this.wait_for_output(1);

        this.then(function () {
            var outputs = get_outputs(1);
            this.test.assertEquals(outputs.length, 1, 'cell 1 has the right number of outputs');
            this.test.assertEquals(outputs[0].data['text/plain'], '5', 'cell 1 produces the correct output');
        });
       });

    });


    //Libraries with Multi tags
    this.then(function() {
        this.evaluate(function () {
                    Jupyter.notebook.clear_all_output();
                    Jupyter.notebook.kernel.restart();
                  });

          this.wait_for_kernel_ready();

          // ensures kernel is running before test
        this.then(function () {
                this.test.assert(this.kernel_running(), 'Start multi-tag test');
            });

        this.then(function () {
            this.evaluate(function () {
                Jupyter.notebook.insert_cell_at_index("code", 0);
                var cell = Jupyter.notebook.get_cell(0);
                cell.set_text('import sys, os\na,b=3,4');
                cell.execute();
            });
        });

        this.wait_for_output(0);

        this.then(function () {
            var outputs = get_outputs(0);
            this.test.assertEquals(outputs.length, 4, 'cell 0 has the right number of outputs');
            this.test.assertEquals(outputs[2].data['text/plain'], '3', 'cell 0 produces the correct output');
            this.test.assertEquals(outputs[3].data['text/plain'], '4', 'cell 0 produces the correct output');
        });


        this.then(function () {
            this.evaluate(function () {
                var uuid = Jupyter.notebook.get_cell(0).uuid;
                var cell = Jupyter.notebook.get_cell(1);
                cell.set_text('Out[' + uuid + ']');
                cell.execute();
                Jupyter.notebook.insert_cell_at_index("code", 2);
                var cell = Jupyter.notebook.get_cell(2);
                cell.set_text('Out[' + uuid + '][0]');
                cell.execute();
            });
        });

        this.wait_for_output(1);
        this.wait_for_output(2);

        this.then(function () {
            var outputs = get_outputs(1);
            this.test.assertEquals(outputs.length, 1, 'cell 1 has the right number of outputs');
            this.test.assertEquals(outputs[0].data['text/plain'], '(3, 4)', 'cell 1 produces the correct output');
            var outputs = get_outputs(2);
            this.test.assertEquals(outputs.length, 1, 'cell 1 has the right number of outputs');
            this.test.assertEquals(outputs[0].data['text/plain'], '3', 'cell 1 produces the correct output');
        });
    });


    this.then(function() {
       this.then(function(){
          this.evaluate(function () {
            Jupyter.notebook.clear_all_output();
            Jupyter.notebook.kernel.restart();
          });

          this.wait_for_kernel_ready();

          // ensures kernel is running before test
        this.then(function () {
            this.test.assert(this.kernel_running(), 'Start combined test');
        });

          this.then(function () {
            this.evaluate(function () {
                var cell = Jupyter.notebook.get_cell(0);
                cell.set_text('import sys, os\na,b=3,4\na,b,5');
                cell.execute();
            });
        });

        this.wait_for_output(0);

        this.then(function () {
            var outputs = get_outputs(0);
            this.test.assertEquals(outputs.length, 5, 'cell 0 has the right number of outputs');
            this.test.assertEquals(outputs[2].data['text/plain'], '3', 'cell 0 produces the correct output');
            this.test.assertEquals(outputs[3].data['text/plain'], '4', 'cell 0 produces the correct output');
            this.test.assertEquals(outputs[4].data['text/plain'], '5', 'cell 0 produces the correct output');
        });


        this.then(function () {
            this.evaluate(function () {
                var cell = Jupyter.notebook.get_cell(1);
                var uuid = Jupyter.notebook.get_cell(0).uuid;
                cell.set_text('Out[' + uuid + ']');
                cell.execute();
                var cell = Jupyter.notebook.get_cell(2);
                cell.set_text('Out[' + uuid + '][0]');
                cell.execute();
            });
        });

        this.wait_for_output(1);
        this.wait_for_output(2);

        this.then(function () {
            var outputs = get_outputs(1);
            this.test.assertEquals(outputs.length, 1, 'cell 1 has the right number of outputs');
            this.test.assertEquals(outputs[0].data['text/plain'], '(3, 4, 5)', 'cell 1 produces the correct output');
            var outputs = get_outputs(2);
            this.test.assertEquals(outputs.length, 1, 'cell 1 has the right number of outputs');
            this.test.assertEquals(outputs[0].data['text/plain'], '3', 'cell 1 produces the correct output');
        });
       });

    });

});
