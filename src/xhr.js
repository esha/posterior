var XHR = JCX.xhr = function() {
    return XHR.main.apply(this, arguments);
};

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

    promise = promise
        .then(cfg.always, XHR.rethrow(cfg.always))
        .then(cfg.then, cfg.catch);

    xhr.cfg = cfg;
    promise.xhr = xhr;
    return promise;
};

XHR.create = function(cfg) {
    var xhr = new XMLHttpRequest();
    xhr.open(XHR.method(cfg),
             XHR.url(cfg),
             cfg.async, cfg.username, cfg.password);
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

XHR.method = function(cfg) {
    return XHR.methodMap[cfg.method] || cfg.method || 'GET';
};

XHR.methodMap = {
    PATCH: 'POST'
};

XHR.url = function(cfg) {
    var url = cfg.url;
    while (url.indexOf('..') >= 0) {
        url = url.replace(/[\/\?\&][^\/\.\?\&]+[\/\?\&]?\.\.([\/\?\&]?)/, '$1');
    }
    return url;
};

XHR.promise = function(xhr, cfg) {
    return new Promise(function(resolve, reject) {
        XHR.active++;

        xhr.onload = function() {
            try {
                //TODO: redefine these as getters
                XHR.parse(xhr);
                XHR.headers(xhr);
                var status = xhr.status || 200;// file: reports 0, treat as 200
                (status >= 200 && status < 400 ? resolve : reject)(xhr);
            } catch (e) {
                xhr.error = e;
                reject(xhr);
            }
        };
        xhr.onerror = function(e) {
            xhr.error = e;
            reject(xhr);
        };

        try {
            xhr.send(XHR.data(cfg));
        } catch (e) {
            xhr.error = e;
            reject(xhr);
        }
    })
    .then(XHR.end, XHR.rethrow(XHR.end))
    .catch(XHR.rethrow(XHR.retry));
};

XHR.data = function(cfg) {
    var data = cfg.data;
    if (cfg.serialize) {
        data = cfg.serialize(data);
    }
    if (data !== undefined && typeof data !== "string") {
        data = JSON.stringify(data);
    }
    return data || '';
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
    var handler = xhr.cfg[xhr.status];
    return handler && handler(xhr) || xhr;
};

XHR.key = function(cfg) {
    return XHR.url(cfg)+'|'+XHR.method(cfg)+'|'+XHR.data(cfg);
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

XHR.rethrow = function(fn) {
    if (fn) {
        return function rethrow(xhr) {
            var ret = fn(xhr);
            return ret !== xhr && ret !== undefined ?
                ret :
                xhr.error || xhr.status >= 400 || xhr.status < 200 ?
                    Promise.reject(xhr) :
                    xhr;
        };
    }
};

XHR.retry = function(xhr) {
    var retry = xhr.cfg.retry;
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
