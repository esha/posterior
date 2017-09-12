<%= banner %>
(function(D, store) {
    "use strict";

var Posterior = window.Posterior = function(config, name) {
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

})(window.document, window.store || function(){});
