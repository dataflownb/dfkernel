//
// Checks that completions work properly
//
casper.notebook_test(function () {

    casper.get_completer_results = function(i,j){
        return this.evaluate(function (i,j) {
            var cell = IPython.notebook.get_cell(i);
            return cell.completer.raw_result[j].str;
    }, {i:i,j:j});
    };

    casper.get_uuid = function(index){
      return this.evaluate(function(i){
          var cell = IPython.notebook.get_cell(i);
          return cell.uuid;
      },index);
    };

    casper.start_completion = function(index){
        return this.evaluate(function (i) {
            var cell = IPython.notebook.get_cell(i);
            cell.completer.startCompletion();
        },index);
    };

    casper.wait_for_completion = function (cell_num) {
        this.wait_for_idle();
        this.then(function() {
            this.waitFor(function (c) {
                return this.evaluate(function get_completer(c) {
                    var cell = IPython.notebook.get_cell(c);
                    return !(cell.completer.done);
                },
                // pass parameter from the test suite js to the browser code js
                {c : cell_num});
            },
            function then() { },
            function timeout() {
                this.echo("wait_for_completion timed out on cell "+cell_num+".");
                var pn = this.evaluate(function get_prompt(c) {
                    return (IPython.notebook.get_cell(c)|| {'input_prompt_number':'no cell'}).input_prompt_number;
                });
                this.echo("cell prompt was :'"+pn+"'.");
            });
        });
    };


    this.then(function () {
        this.evaluate(function () {
            Jupyter.notebook.insert_cell_at_index("code", 0);
            var cell = Jupyter.notebook.get_cell(0);
            cell.set_text('aaaaaa=3');
            cell.execute();
        });

        this.wait_for_output(0);
    });

    // Test underscore completion.
    this.then(function () {

        this.then(function () {

            var text = '_';
            var index = this.append_cell(text);

            this.then(function () {
                this.set_cell_editor_cursor(index, 0, 1);
                this.start_completion(index);
            });

            this.wait_for_completion(index);

            this.then(function () {
                var completed = this.get_completer_results(index,0);
                this.test.assertEquals(completed, 'aaaaaa', 'Underscore successfully completes to aaaaaa');
            });
        });
    });

    // Test auto-finish completion.
    this.then(function () {

        this.then(function () {

            var text = 'aa';
            var index = this.append_cell(text);

            this.then(function () {
                this.set_cell_editor_cursor(index, 0, 2);
                this.start_completion(index);
            });

            this.wait_for_completion(index);

            this.then(function () {
                var completed = this.get_completer_results(index,0);
                this.test.assertEquals(completed, 'aaaaaa', 'aa successfully completes to aaaaaa');
            });
        });
    });


    this.then(function () {
        this.evaluate(function () {
            Jupyter.notebook.insert_cell_at_index("code", 0);
            var cell = Jupyter.notebook.get_cell(0);
            cell.set_text('a,b=3,4');
            cell.execute();
        });

        this.wait_for_output(0);
    });

    // Test underscore for multiple tags
    this.then(function () {

        this.then(function () {

            var text = '_';
            var index = this.append_cell(text);

            this.then(function () {

                this.set_cell_editor_cursor(index, 0, 1);
                this.start_completion(index);
            });

            this.wait_for_completion(index);

            this.then(function () {
                var completed = this.get_completer_results(index,0);
                this.test.assertEquals(completed, '(a,b)', 'underscore successfully completes to (a,b)');
            });
        });
    });

    this.then(function () {
        this.evaluate(function () {
            Jupyter.notebook.insert_cell_at_index("code", 0);
            var cell = Jupyter.notebook.get_cell(0);
            cell.set_text('5');
            cell.execute();
        });

        this.wait_for_output(0);
    });

    // Test underscore for Out[]
    var global_uuid = '';

    this.then(function () {

        this.then(function () {

            var text = '_';
            var index = this.append_cell(text);
            var uuid = '';

            this.then(function () {
                uuid = global_uuid = this.get_uuid(0);
                this.set_cell_editor_cursor(index, 0, 1);
                this.start_completion(index);
            });

            this.wait_for_completion(index);

            this.then(function () {
                var completed = this.get_completer_results(index,0);
                this.test.assertEquals(completed, 'Out['+uuid+']', 'underscore successfully completes to Out['+uuid+']');
            });
        });
    });

    this.then(function () {
        this.evaluate(function () {
            Jupyter.notebook.insert_cell_at_index("code", 0);
            var cell = Jupyter.notebook.get_cell(0);
            cell.set_text('raise()');
            cell.execute();
        });

        this.wait_for_output(0);
    });

    // Test underscore for Error Completions
    this.then(function () {

        this.then(function () {

            var text = '_';
            var index = this.append_cell(text);
            var uuid = '';

            this.then(function () {
                uuid = this.get_uuid(0);
                this.set_cell_editor_cursor(index, 0, 1);
                this.start_completion(index);
            });

            this.wait_for_completion(index);

            this.then(function () {
                var completed = this.get_completer_results(index,0);
                this.test.assertNotEquals(completed, 'Out['+uuid+']', 'underscore does not complete to Out['+uuid+']');
                this.test.assertEquals(completed, 'Out['+global_uuid+']', 'underscore still completes to Out['+global_uuid+']');
            });
        });
    });

});
