var XHR = JCX.xhr = function(options) {
    var xhr = new XMLHttpRequest(),
        method = XHR.methodMap[options.method] || options.method;
    xhr.options = options;
    xhr.open(method, options.url, options.async, options.username, options.password);
    if (options.xhrFields) {
        for (var field in options.xhrFields) {
            xhr[field] = options.xhrFields[field];
        }
    }
    if (options.mimeType) {
        xhr.overrideMimeType(options.mimeType);
    }
    if (options.headers) {
        for (var header in options.headers) {
            xhr.setRequestHeader(header, options.headers[header]);
        }
    }

    var promise = new Promise(function(resolve, reject) {
        xhr.onload = function() {
            XHR.json(xhr);
            XHR.headers(xhr);
            var status = xhr.status || 200;// file: reports 0, treat as 200
            (status >= 200 && status < 400 ? resolve : reject)(xhr);
        };
        xhr.onerror = function() {
            reject(xhr);
        };

        XHR.active++;
        xhr.send(options.data || null);
    })
    .then(XHR.end, XHR.end)
    .then(options.success, options.error)
    .then(XHR.success, XHR.error);

    promise.xhr = xhr;
    return promise;
};

XHR.methodMap = {
    PATCH: 'POST'
};

XHR.active = 0;

XHR.json = function(xhr) {
    try {
        xhr.responseJson = JSON.parse(xhr.responseText);
    } catch (e) {}
};

XHR.headers = function(xhr) {
    var headers = {},
        all = xhr.getAllResponseHeaders().trim().split('\n');
    for (var i=0,m=all.length, header; i<m; i++) {
        if ((header = all[i])) {
            var parts = header.match(/^([\w\-]+):(.*)/);
            if (parts.length === 3) {
                headers[parts[1]] = parts[2].trim();
            }
        }
    }
    return xhr.responseHeaders = headers;
};

XHR.end = function(xhr) {
    XHR.active--;
    var handler = xhr.options[xhr.status] || XHR[xhr.status];
    return handler && handler(xhr) || xhr;
};
