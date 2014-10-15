var XHR = JCX.xhr = function(cfg) {
    return XHR.main(cfg);
},
htmlClass = D.documentElement.classList;

XHR.ctor = XMLHttpRequest;
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
        xhr = new XHR.ctor();
        XHR.config(xhr, cfg);
        promise = XHR.promise(xhr, cfg);
        if (cfg.retry) {
            promise = promise.catch(XHR.retry.bind(xhr));
        }
    }
    if (cfg.then) {
        promise = promise.then(cfg.then);
    }
    if (cfg.catch) {
        promise = promise.catch(cfg.catch);
    }
    promise.xhr = xhr;
    return promise;
};

XHR.config = function(xhr, cfg) {
    xhr.open(XHR.method(cfg),
             XHR.url(cfg),
             'async' in cfg ? cfg.async : true,
             cfg.username, cfg.password);
    xhr.cfg = cfg;
    for (var prop in cfg) {
        var value = cfg[prop];
        if (prop in xhr) {
            xhr[prop] = value;
        }
        if (typeof value === "function") {
            xhr.addEventListener(prop, cfg[prop] = value.bind(xhr));
        }
    }
    if (cfg.mimeType) {
        xhr.overrideMimeType(cfg.mimeType);
    }
    if (cfg.requestedWith !== false) {
        xhr.setRequestHeader('X-Requested-With', cfg.requestedWith || 'XMLHttpRequest');
    }
    if (cfg.json !== false) {
        xhr.responseType = 'json';
        xhr.setRequestHeader('Accept', 'application/json');
        xhr.setRequestHeader('Content-Type', 'application/json');
    }
    if (cfg.headers) {
        for (var header in cfg.headers) {
            xhr.setRequestHeader(header, cfg.headers[header]);
        }
    }
};

XHR.method = function(cfg) {
    return XHR.methodMap[cfg.method] || cfg.method || 'GET';
};
XHR.methodMap = {
    PATCH: 'POST'
};

XHR.url = function(cfg) {
    var url = cfg.url,
        was;
    while (was !== url) {
        was = url;
        url = url.replace(/([\/\?\&]|^)[^\/\.\?\&]+[\/\?\&]?\.\.([\/\?\&]?)/, '$1');
    }
    return url;
};

XHR.promise = function(xhr, cfg) {
    return new Promise(function(resolve, reject) {
        var fail = function(e) {
            reject(xhr.error = e);
        },
        events = {
            error: fail,
            timeout: fail,
            loadstart: XHR.start,
            loadend: XHR.end,
            load: XHR.load(xhr, cfg, resolve, fail)
        };
        for (var event in events) {
            xhr.addEventListener(event, events[event]);
        }

        try {
            xhr.send(XHR.data(cfg));
        } catch (e) {
            fail(e);
        }
    });
};

XHR.load = function(xhr, cfg, resolve, reject) {
    return function() {
        try {
            // cfg status code handling (e.g. {0: 200} for file://)
            var status = cfg[xhr.status] || xhr.status;
            if (typeof status === "function") {
                status = status(xhr) || xhr.status;
            }
            if (status >= 200 && status < 300) {
                if (cfg.json !== false && typeof xhr.response !== "object") {
                    XHR.forceJSONResponse(xhr);
                }
                if (cfg.cache) {
                    XHR.cache(xhr);
                }
                var data = xhr.responseType ? xhr.response :
                           cfg.json !== false ? xhr.responseObject :
                           xhr.responseText;
                if (cfg.responseData && XHR.isData(data)) {
                    var ret = cfg.responseData(data);
                    data = ret === undefined ? data : ret;
                }
                resolve(XHR.isData(data) ? data : xhr);
            } else {
                reject(status);
            }
        } catch (e) {
            reject(e);
        }
    };
};

XHR.forceJSONResponse = function(xhr) {
    try {
        delete xhr.response;
        Object.defineProperty(xhr, 'response', { value: xhr.responseObject, enumerable: true, configurable: true });
    } catch (e) {}
};

XHR.isData = function(data) {
    // reject as impossible output by JSON.stringify, invalid input to JSON.parse
    return !(data === undefined || data === '');
};
XHR.data = function(cfg) {
    var data = cfg.data;
    if (cfg.requestData && XHR.isData(data)) {
        var ret = cfg.requestData(data);
        data = ret === undefined ? data : ret;// return new object or keep old
    }
    if (data !== undefined && typeof data !== "string") {
        data = JSON.stringify(data);
    }
    return data || '';
};

XHR.properties = {
    responseObject: {
        get: function() {
            var response = null;
            try {
                if (this.responseText) {
                    response = JSON.parse(this.responseText);
                }
            } catch (e) {}
            if (response === null && typeof this.response === 'object') {
                response = this.response;
            }
            Object.defineProperty(this, 'responseObject', {value:response});
            return response;
        },
        enumerable: true,
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
        enumerable: true,
        configurable: true
    }
};
Object.defineProperties(XMLHttpRequest.prototype, XHR.properties);

XHR.active = 0;
XHR.activeClass = 'xhr-active';
XHR.start = function() {
    XHR.active++;
    htmlClass.add(XHR.activeClass);
};
XHR.end = function() {
    if (!--XHR.active) {
        htmlClass.remove(XHR.activeClass);
    }
};

XHR.key = function(cfg) {
    return XHR.url(cfg)+'|'+XHR.method(cfg)+'|'+XHR.data(cfg);
};
XHR.cache = function(xhr) {
    var cfg = xhr.cfg;
    store(XHR.key(cfg), XHR.safeCopy(xhr), cfg.cache);
    return xhr;
};
XHR.safeCopy = function(object, copied) {
    var copy = {};
    copied = copied || [];
    if (copied.indexOf(object) < 0) {
        copied.push(object);
        for (var name in object) {
            try {
                var value = object[name],
                    type = typeof value;
                if (type === 'function') {
                    value = undefined;
                } else if (type === 'object') {
                    value = XHR.safeCopy(value, copied);
                }
                if (value !== undefined) {
                    copy[name] = value;
                }
            } catch (e) {}
        }
        return copy;
    }
};

XHR.retry = function(e) {
    var xhr = this,
        retry = xhr.cfg.retry;
    if ((retry.limit || 3) > retry.count) {
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
    return Promise.reject(e);
};
