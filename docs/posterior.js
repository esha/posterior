/*! posterior - v0.19.2 - 2017-10-05
* http://esha.github.io/posterior/
* Copyright (c) 2017 ESHA Research; Licensed  */

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
            } else {
                reject(xhr.error = e);
            }
        },
        events = {
            error: fail,
            timeout: fail,
            loadstart: XHR.start,
            loadend: XHR.end,
            load: XHR.load(cfg, resolve, fail)
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
                        var ret = cfg.responseData.call(xhr, data);
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

/*
'conf': 'standard config, combine w/ancestor'
'_private': 'this config not inherited'
'!conf': 'ignore ancestor'

'.util': 'API prop/fn'
'@sub': { 'sub API': 'to build' }

requires: [testFn, 'name.of.api']
auto: true//'call async upon build'

_self, parent, name are reserved

string values are processed at call-time against data/conf/window
function-function concat results in promise fn wrapper
function-* concat becomes result of calling fn w/* as arg
object concat means copy/merge
string/int concat means usual
boolean concat means &&

*/
var API = Posterior.api = function(config, name) {
    var parent = config.parent || null;
    if (parent && parent.cfg) {
        parent = parent.cfg;
    }
    return API.build(config, parent, name);
};

API.build = function(config, parent, name) {
    var fn = function() {
        return API.main(fn, arguments);
    },
    cfg = {
        _fn: fn,
        _parent: parent,
        _private: {},
        name: name || 'Posterior'
    };

    if (config.debug || API.get(cfg, 'debug')) {
        fn = cfg._fn = API.debug(cfg.name, fn);
    }
    for (var prop in config) {
        API.set(cfg, prop, config[prop], cfg.name);
    }

    fn.cfg = cfg;
    fn.config = API.config;
    fn.extend = API.extend;
    if (API.get(cfg, 'auto')) {
        setTimeout(fn, 0);
    }
    return fn;
};

API.extend = function(config, name) {
    return API.build(config, this.cfg, name);
};

API.main = function(fn, args) {
    if (fn.cfg._singletonResult) {
        return Promise.resolve(fn.cfg._singletonResult);
    }

    var cfg = API.getAll(fn.cfg);
    // data must be an object or array
    cfg._args = args;
    cfg.data = (args.length > 1 || typeof args[0] !== "object") ?
        Array.prototype.slice.call(args) :
        args[0];
    API.process(cfg);
    var promise = API.promise(cfg, fn);

    if (cfg.singleton) {
        promise.then(function(result) {
            fn.cfg._singletonResult = result;
        });
    }
    return promise;
};

API.promise = function(cfg, fn) {
    var deps = cfg.requires;
    return deps ?
        Promise.all(deps.map(API.require.bind(cfg))).then(function() {
            return API.follow(cfg, fn);
        }) :
        API.follow(cfg, fn);
};

API.follow = function(cfg, fn) {
    if (cfg.follows) {
        var follows = cfg.follows,
            leader;
        if (typeof follows === "object") {
            leader = follows.source;
            follows = follows.path;
        }
        if (!leader) {
            leader = fn.cfg._parent._fn;
        }
        if (leader) {
            var lead = leader.apply(null, cfg._args || []);
            return lead.then(function follow(resource) {
                cfg.url = follows && eval('resource.'+follows) || resource;
                return XHR(cfg);
            });
        } else {
            return Promise.reject("Cannot follow link relation without a source function.");
        }
    } else {
        return XHR(cfg);
    }
};

API.require = function(req) {
    try {
        if (typeof req === 'string') {
            req = eval('window.'+req);
        }
        if (typeof req === 'function') {
            req = req() || req;
        }
        return req ? Promise.resolve(req) : Promise.reject(req);
    } catch (e) {
        return Promise.reject(e);
    }
};

API.config = function(name, value) {
    return name ?
        value === undefined ?
            API.get(this.cfg, name) :
            API.set(this.cfg, name, value) :
        API.getAll(this.cfg);
};

API.process = function(cfg) {
    if (cfg.configure) {
        cfg.configure(cfg);
    }
    for (var name in cfg) {
        var value = cfg[name];
        if (typeof value === 'string') {
            value = cfg[name] = API.resolve(value, cfg.data, cfg, cfg.consumeData);
        }
    }
};

API.resolve = function(string, data, cfg, consume) {
    var key,
        str = string,
        re = /\$?\{([^}]+)\}/g,
        used = [];
    while ((key = re.exec(string))) {
        key = key[1];
        var val = null;
        if (key in data) {
            val = data[key];
            if (consume !== false && used.indexOf(key) < 0) {
                used.push(key);
            }
        } else {
            try {
                val = eval('data.'+key);
                // escape key for replace call at end
                key = key.replace(/(\[|\.)/g, '\\$1');
            } catch (e) {}
            if (val === undefined && cfg && key in cfg) {
                val = cfg[key];
            }
        }
        if (val === null || val === undefined) {
            val = '';
        }
        str = str.replace(new RegExp('\\$?\\{'+key+'}'), val);
    }
    if (consume !== false && used.length > 0) {
        if (Array.isArray(data)) {
            used.sort();
            for (var i=used.length-1; i>=0; i--) {
                data.splice(used[i], 1);
            }
        } else {
            for (var j=0; j<used.length; j++) {
                delete data[used[j]];
            }
        }
    }
    return str;
};

API.getAll = function(cfg, inheriting) {
    var all = cfg._parent ? API.getAll(cfg._parent, true) : {};
    API.copy(all, cfg);
    if (!inheriting) {
        API.copy(all, cfg._private);
    }
    return all;
};

API.copy = function(to, from) {
    for (var name in from) {
        if (name.charAt(0) !== '_' && (name !== 'name' || !(name in to))) {
            if (name.charAt(0) === '!') {
                to[name.substring(1)] = from[name];
            } else {
                to[name] = API.combine(to[name], from[name], to);
            }
        }
    }
};

API.get = function(cfg, name, inheriting) {
    var priv = cfg._private,
        iname = '!'+name;
    if (!inheriting && iname in priv) {
        return priv[iname];
    }
    if (iname in cfg) {
        return cfg[iname];
    }
    var value = inheriting ? cfg[name] :
                API.combine(cfg[name], priv[name], cfg);
    if (cfg._parent) {
        return API.combine(API.get(cfg._parent, name, true), value, cfg);
    }
    return value;
};

API.getter = function(fn, name) {
    try {
        Object.defineProperty(fn, name, {
            get: function() {
                return API.get(fn.cfg, name);
            },
            configurable: true
        });
    } catch (e) {}// ignore failures
};

API.set = function(cfg, prop, value, parentName) {
    var api = cfg._fn,
        first = prop.charAt(0),
        subname = parentName+(first==='.'?'':'.')+prop;
    if (typeof value === "function" && API.get(cfg, 'debug')) {
        value = API.debug(subname, value);
    }
    if (first === '_') {
        cfg._private[prop = prop.substring(1)] = value;
    } else if (first === '@' ||
        (typeof value === "object" && first !== first.toLowerCase())) {
        if (first === '@') {
            prop = prop.substring(1);
        }
        api[prop] = API.build(value, cfg, subname);
    } else {
        if (first === '.') {
            prop = prop.substring(1);
        }
        cfg[prop] = value;
    }
    // let config props be accessed from the api function
    if (!(prop in api)) {
        API.getter(api, prop);
    }
};

API.log = function(args, level) {
    var console = W.console,
        log = console && console[level || 'log'];
    if (log) {
        log.apply(console, args);
    }
};
API.debug = function(name, fn) {
    return function debug(arg) {
        var args;
        try {
            var ret = fn.apply(this, arguments);
            if (ret !== undefined && ret !== arg) {
                args = [name+'('];
                args.push.apply(args, arguments);
                args.push(') resolved to ', ret);
                API.log(args, 'debug');
            }
            return ret;
        } catch (e) {
            args = Array.prototype.concat.apply([name, e], arguments);
            API.log(args, 'error');
            throw e;
        }
    };
};

API.combine = function(pval, val, cfg) {
    var ptype = API.type(pval),
        type = API.type(val);
    return (
        // ignore null/undefined operands
        !type ? pval :
        !ptype ? val :
        // mismatched types
        type !== ptype ?
            ptype === 'function' ? pval.call(cfg, val) :
            type === 'function' ? val.call(cfg, pval) :
            ptype === 'array' ? pval.concat(val) :
            type === 'array' ? [].concat.apply([pval], val) :
                pval + val :
        // matched types
        type === 'function' ? API.combineFn(pval, val) :
        type === 'object' ? API.combineObject(pval, val) :
        type === 'array' ? pval.concat.apply(pval, val) :
        type === 'boolean' ? (pval && val) :
            pval + val
    );
};

API.combineFn = function(pfn, fn) {
    return function combined(res) {
        var ret = pfn.call(this, res);
        ret = fn.call(this, ret === undefined ? res : ret);
        return ret === undefined ? res : ret;
    };
};

API.combineObject = function(pobj, obj) {
    var combo = {};
    for (var name in pobj) {
        combo[name] = pobj[name];
    }
    for (name in obj) {
        combo[name] = obj[name];
    }
    return combo;
};

API.type = function(val) {
    var type = typeof val;
    return type === 'object' ?
        Array.isArray(val) ? 'array' :
            !val ? null : type :
        type === 'undefined' ? null : type;
};

Posterior.version = "0.19.2";

if (typeof module !== 'undefined' && module.exports) {
    module.exports = Posterior;
} else {
    if (W.Posterior){ Posterior.conflict = W.Posterior; }
    W.Posterior = Posterior;
}

})(window || this);
