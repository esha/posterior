var XHR = Posterior.xhr = function(cfg) {
    return XHR.main(cfg);
};

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
        if (cfg.cache) {
            promise.then(function() {
                XHR.cache(xhr);
            });
        }
    }
    if (cfg.then) {
        promise = promise.then(cfg.then);
    }
    if (cfg.catch) {
        // call catch with cfg as context and xhr as second arg
        promise = promise.catch(function caught(error) {
            return cfg.catch.call(cfg, error, xhr);
        });
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
    cfg.xhr = xhr;
    for (var prop in cfg) {
        var value = cfg[prop];
        if (typeof value === "function") {
            if (prop === "then" || prop === "catch") {
                cfg[prop] = value.bind(cfg);
            }
            xhr.addEventListener(prop, value.bind(xhr));
        } else if (prop in xhr) {
            xhr[prop] = value;
        }
    }
    if (cfg.mimeType) {
        xhr.overrideMimeType(cfg.mimeType);
    }
    // make sure headers we set are also exposed in the config
    var headers = cfg.headers || (cfg.headers = {});
    if (cfg.requestedWith !== false) {
        headers['X-Requested-With'] = cfg.requestedWith || 'XMLHttpRequest';
    }
    if (cfg.json !== false) {
        try {
            xhr.responseType = 'json';// unsupported by phantomjs (webkit)
        } catch (e) {}
        // don't squash existing headers
        if (!headers.Accept) {
            headers.Accept = 'application/json';
        }
        if (!headers['Content-Type']) {
            headers['Content-Type'] = 'application/json';
        }
    }
    for (var header in headers) {
        xhr.setRequestHeader(header, headers[header]);
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
            if (cfg.retry) {
                XHR.retry(cfg, cfg.retry, events, fail);
            } else if (cfg.debug === 'capture') {
                XHR.capture(xhr, cfg, e);
                reject(e);
            } else {
                reject(xhr.error = e);
            }
        },
        succeed = cfg.debug === 'capture' ?
            function(result) {
                XHR.capture(xhr, cfg, result);
                resolve(result);
            } :
            resolve,
        events = {
            error: fail,
            timeout: fail,
            loadstart: XHR.start,
            loadend: XHR.end,
            load: XHR.load(cfg, succeed, fail)
        };
        XHR[cfg.throttle ? 'throttle' : 'run'](xhr, cfg, events, fail);
    });
};

XHR.retry = function(cfg, retry, events, fail) {
    if (typeof retry !== 'object') {
        retry = cfg.retry = {};
    }
    retry.wait = 'wait' in retry ? retry.wait : 1000;
    retry.limit = 'limit' in retry ? retry.limit : 3;
    retry.count = 'count' in retry ? retry.count : 0;
    if (retry.limit > retry.count++) {
        setTimeout(function retryAfterWait() {
            var xhr = new XHR.ctor();
            XHR.config(xhr, cfg);
            XHR.run(xhr, cfg, events, fail);
        }, retry.wait *= 2);
    }
};

XHR.throttle = function(xhr, cfg, events, fail) {
    var all = XHR.throttles || (XHR.throttles = {}),
        throttle = cfg.throttle,
        record = all[throttle.key];
    if (!record) {
        record = all[throttle.key] = {
            queue: 0,
            lastRun: Date.now() - throttle.ms
        };
    }
    record.queue++;
    var next = (record.lastRun + (record.queue * throttle.ms)) - Date.now(),
        runFn = function throttled() {
            XHR.run(xhr, cfg, events, fail);
            record.queue--;
            record.lastRun = Date.now();
        };
    if (next > 10) {
        setTimeout(runFn, next);
    } else {
        runFn();
    }
};

XHR.run = function(xhr, cfg, events, fail) {
    for (var event in events) {
        xhr.addEventListener(event, events[event]);
    }
    try {
        xhr.send(XHR.data(cfg));
    } catch (e) {
        fail(e);
    }
};

XHR.load = function(cfg, resolve, reject) {
    return function() {
        try {
            // cfg status code mapping (e.g. {0: 200} for file://)
            var xhr = cfg.xhr,
                status = cfg[xhr.status] || xhr.status,
                json = cfg.json !== false;
            if (typeof status === "function") {
                // support status code specific hook functions
                status = status(xhr) || xhr.status;
            }
            if (status >= 200 && status < 300) {
                if (json && typeof xhr.response !== "object") {
                    XHR.forceJSONResponse(xhr);
                }
                var data = xhr.responseType ? xhr.response :
                           json ? xhr.responseObject :
                           xhr.responseText;
                if (json && data === null) {
                    reject('Presumed syntax error in JSON response, suppressed by your browser.');
                } else {
                    if (cfg.responseData && XHR.isData(data)) {
                        var ret = xhr.responseData = cfg.responseData(data, xhr);
                        data = ret === undefined ? data : ret;
                    }
                    resolve(XHR.isData(data) ? data : xhr);
                }
            } else {
                var error;
                if (cfg.failure) {
                    // allow failure listener to set result
                    error = cfg.failure(status, xhr);
                }
                reject(error !== undefined ? error : status);
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
    if (cfg.requestData) {
        var ret = cfg.requestData(data);
        data = ret === undefined ? data : ret;// return new object or keep old
    }
    if (data instanceof Object && data.hasOwnProperty('toString')) {
        data = data.toString();
    } else if (data !== undefined && typeof data !== 'string') {
        data = JSON.stringify(data);
    }
    return cfg.requestBody = data || '';
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
XHR.notify = function(){};
if (D) {
    var htmlClassList = D.documentElement.classList;
    XHR.activeClass = 'xhr-active';
    XHR.notify = function(isActive) {
        htmlClassList[isActive ? 'add' : 'remove'](XHR.activeClass);
    };
}
// track number of active requests
// only notify when number changes to/from zero
XHR.start = function() {
    if (++XHR.active === 1) {
        XHR.notify(true);
    }
};
XHR.end = function() {
    if (--XHR.active === 0) {
        XHR.notify(false);
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
XHR.capture = function(xhr, cfg, data) {
    var fn = cfg._fn;
    fn.capture = {
        method: cfg.method || 'GET',
        status: xhr.status,
        url: API.resolve(cfg.url, cfg.data, null, false),
        requestHeaders: cfg.headers,
        requestData: cfg.data,
        requestBody: cfg.requestBody,
        responseHeaders: xhr.responseHeaders,
        responseBody: xhr.responseBody,
        responseData: data
    };
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
