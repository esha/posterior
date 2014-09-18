var XHR = JCX.xhr = function() {
    return XHR.main.apply(this, arguments);
},
htmlClass = D.documentElement.classList;

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
             'async' in cfg ? cfg.async : true,
             cfg.username, cfg.password);
    for (var prop in cfg) {
        if (prop in xhr) {
            xhr[prop] = cfg[prop];
        }
    }
    if (cfg.mimeType) {
        xhr.overrideMimeType(cfg.mimeType);
    }
    xhr.setRequestHeader('X-Requested-With', 'XMLHttpRequest');
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
        XHR.start();

        var error = xhr.onerror = function(e) {
            xhr.error = e;
            reject(xhr);
        };
        xhr.onload = function() {
            try {
                // allow cfg to re-map status codes (e.g. {0: 200} for file://)
                var status = cfg.status ? cfg.status[xhr.status] : xhr.status;
                (status >= 200 && status < 400 ? resolve : reject)(xhr);
            } catch (e) {
                error(e);
            }
        };
        if (xhr.timeout) {
            xhr.ontimeout = error;
        }

        try {
            xhr.send(XHR.data(cfg));
        } catch (e) {
            error(e);
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

Object.defineProperties(
    XMLHttpRequest.prototype,
    {
        responseValue: {
            get: function() {
                if (this.responseText) {
                    var object = JSON.parse(this.responseText);
                    Object.defineProperty(this, 'responseValue', {value:object});
                    return object;
                }
            },
            configurable: true
        },
        responseHeaders: {
            get: function() {
                var headers = {},
                    all = this.getAllResponseHeaders().trim().split('\n');
                for (var i=0,m=all.length, header; i<m; i++) {
                    if ((header = all[i])) {
                        var parts = header.match(/^([\w\-]+):(.*)/);
                        if (parts.length === 3) {
                            headers[parts[1]] = parts[2].trim();
                        }
                    }
                }
                Object.defineProperty(this, 'responseHeaders', {value:headers});
                return headers;
            },
            configurable: true
        }
    }
);

XHR.active = 0;
XHR.start = function() {
    XHR.active++;
    htmlClass.add('jcx-loading');
};
XHR.end = function(xhr) {
    XHR.active--;
    if (!XHR.active) {
        htmlClass.remove('jcx-loading');
    }
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
    if (retry && (retry.limit || 3) > retry.count) {
        if (typeof retry === 'number') {
            retry = { wait: retry };
        }
        return new Promise(function(resolve) {
            setTimeout(function() {
                retry.count = (retry.count || 0) + 1;
                retry.wait = (retry.wait || 1000) * 2;
                resolve(XHR(xhr.cfg));
            }, retry.wait || 1000);
        });
    }
    return xhr;
};
