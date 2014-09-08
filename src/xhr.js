var XHR = JCX.xhr = function() {
    return XHR.main.apply(this, arguments);
},
global = XHR.global = {};

XHR.main = function(cfg) {
    var xhr, 
        promise;

    if (cfg.cache) {
        xhr = store(XHR.key(cfg));
        if (xhr) {
            promise = Promise.resolve(xhr);
        }
    }
    if (!promise) {
        xhr = XHR.create(cfg);
        promise = XHR.promise(xhr, cfg);
        if (cfg.cache) {
            promise = promise.then(XHR.cache);
        }
    }

    promise = promise.then(cfg.then, cfg.catch)
        .then(cfg.always, cfg.always)
        .then(global.then, global.catch)
        .then(global.always, global.always);

    xhr.cfg = cfg;
    promise.xhr = xhr;
    return promise;
};

XHR.methodMap = {
    PATCH: 'POST'
};

XHR.create = function(cfg) {
    var method = XHR.methodMap[cfg.method] || cfg.method,
        xhr = new XMLHttpRequest();
    xhr.open(method, cfg.url, cfg.async, cfg.username, cfg.password);
    if (cfg.xhrFields) {
        for (var field in cfg.xhrFields) {
            xhr[field] = cfg.xhrFields[field];
        }
    }
    if (cfg.mimeType) {
        xhr.overrideMimeType(cfg.mimeType);
    }
    if (cfg.headers) {
        for (var header in cfg.headers) {
            xhr.setRequestHeader(header, cfg.headers[header]);
        }
    }
    return xhr;
};

XHR.promise = function(xhr, cfg) {
    return new Promise(function(resolve, reject) {
        xhr.onload = function() {
            try {
                XHR.parse(xhr);
                XHR.headers(xhr);
                var status = xhr.status || 200;// file: reports 0, treat as 200
                (status >= 200 && status < 400 ? resolve : reject)(xhr);
            } catch (e) {
                xhr.error = e;
                reject(xhr);
            }
        };
        xhr.onerror = function() {
            //TODO: set error?
            reject(xhr);
        };

        XHR.active++;
        try {
            xhr.send(cfg.data ? JSON.stringify(cfg.data) : null);
        } catch (e) {
            xhr.error = e;
            reject(xhr);
        }
    })
    .then(XHR.end, XHR.end)
    .catch(cfg.retry ? XHR.retry : null);
};

XHR.parse = function(xhr) {
    try {
        xhr.value = JSON.parse(xhr.responseText);
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

XHR.active = 0;
XHR.end = function(xhr) {
    XHR.active--;
    var handler = xhr.cfg[xhr.status] || global[xhr.status];
    return handler && handler(xhr) || xhr;
};

XHR.key = function(cfg) {
    return cfg.url + '|' +
        (cfg.method || 'GET') + '|' +
        (cfg.data ? JSON.stringify(cfg.data) : '');
};
XHR.cache = function(xhr) {
    var cfg = xhr.cfg;
    store(XHR.key(cfg), XHR.safeCopy(xhr), cfg.cache);
};
XHR.safeCopy = function(object) {
    var copy = {};
    for (var name in object) {
        var value = object[name],
            type = typeof value;
        if (value && type !== 'function') {
            copy[name] = type === 'object' ? XHR.safeCopy(value) : value;
        }
    }
    return copy;
};

XHR.retry = function(xhr) {
    var retry = xhr.cfg.retry || global.retry;
    if (retry) {
        var cfg = xhr.cfg;
        return new Promise(function(resolve) {
            setTimeout(function() {
                cfg.retry = retry * 2;
                resolve(XHR(cfg));
            }, retry);
        });
    }
    return xhr;
};
