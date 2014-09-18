<%= banner %>
(function(D, store) {
    "use strict";

var JCX = window.JCX = function(config, name) {
    return JCX.api(config, name);
};
<%= content %>
JCX.version = "<%= version %>";

})(document, window.store || function(){});
