<%= banner %>
(function(W) {
    "use strict";

var store = W.store || function(){},
    D = W.document,
    Posterior = function(config, name) {
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

if (typeof module !== 'undefined' && module.exports) {
    module.exports = Posterior;
} else {
    if (W.Posterior){ Posterior.conflict = W.Posterior; }
    W.Posterior = Posterior;
}

})(window || this);
