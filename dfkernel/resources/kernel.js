define(["base/js/namespace",
    '/kernelspecs/dfpython3/df-notebook/codecell.js',
    '/kernelspecs/dfpython3/df-notebook/completer.js',
    '/kernelspecs/dfpython3/df-notebook/kernel.js',
    '/kernelspecs/dfpython3/df-notebook/notebook.js',
    ],
    function(Jupyter) {
        var onload = function() {
            // initial cell has already been added
            // need to add uuid to it
            // get rid of the first cell and reload it
            Jupyter.notebook.delete_cell(0);
//            Jupyter.notebook.insert_cell_below('code');
//            Jupyter.notebook.edit_mode(0);
//            Jupyter.notebook.get_cells().filter(function (c) {
//            return (c.cell_type == 'code'); }).forEach(function(c) {
//               // make sure we have a uuid
//               // question is whether we have to reset the prototype for the cell...
//               // probably not receiving the event from code mirror about changed cells...
//               // have to check this with opening notebooks, too
//               c.init_dfnb();
//               // set the input prompt to show uuid
//               c.set_input_prompt();
//               c.create_element();
//            });

        };

        return {onload:onload}
});
