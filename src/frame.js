<%= banner %>
(function(store) {
    "use strict";

var JCX = window.JCX = function(config) {
    return JCX.api(config);
};
<%= content %>
JCX.version = "<%= version %>";

})(document, window.store || function(){});
