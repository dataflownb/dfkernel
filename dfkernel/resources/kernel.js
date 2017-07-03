define(['/kernelspecs/dfpython3/df-notebook/codecell.js',
    '/kernelspecs/dfpython3/df-notebook/completer.js',
    '/kernelspecs/dfpython3/df-notebook/kernel.js',
    '/kernelspecs/dfpython3/df-notebook/notebook.js',
    '/kernelspecs/dfpython3/df-notebook/outputarea.js'
    ],
    function() {
        var onload = function(){
            // console.log(extCodeCell);
            console.log("I am being loaded")
        };

        return {onload:onload}
});
