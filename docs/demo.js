(function(window, console, Eventi) {

    // hijack console.debug to echo to a DOM element
    var _console,
        _log = console.log,
        toString = function(obj) {
            if (typeof obj === "object") {
                if (Array.isArray(obj) && obj.length > 1) {
                    obj = '[ '+toString(obj[0])+', ... ]';
                }
            }
            return (obj+'');
        };
    console.log = function() {
        _log.apply(this, arguments);
        if (_console) {
            var args = Array.prototype.map.call(arguments, toString);
            _console.textContent += args.join(' ')+'\n';
        }
    };

    Eventi.on("run", function(e) {
        Eventi.fire('location@#console');

        var demo = e.target.closest('.demo'),
            script = demo.query('.code').textContent;
        _console = demo.query('.console');

        var result = eval(script);
        console.log('Returned:', result);
        result.then(function(value) {
            console.log('Resolved to:', value);
        });

        // expose for REPL
        window.result = result;
    }).on("comments", function(e) {
        Eventi.fire('location@#comments');
    });

})(window, console, Eventi)
