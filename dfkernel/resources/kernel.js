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
            Jupyter.notebook.get_cells().filter(function (c) {
            return (c.cell_type == 'code'); }).forEach(function(c) {
               // make sure we have a uuid
               c.init_dfnb();
               // set the input prompt to show uuid
               c.set_input_prompt();
            });

        };

        return {onload:onload}
});
