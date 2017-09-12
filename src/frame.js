<%= banner %>
(function(W) {
    "use strict";

var store = W.store || function(){},
    D = W.document,
    Posterior = W.Posterior = function(config, name) {
        if (typeof config === "string") {
            config = { url: config };
        }
        if (typeof name === "function") {
            config.then = name;
        }
        return Posterior.api(config, name);
    };

<%= content %>
Posterior.version = "<%= pkg.version %>";

})(window || this);
