/*! jcx - v0.5.1 - 2014-09-19
* http://esha.github.io/jcx/
* Copyright (c) 2014 ESHA Research; Licensed MIT, GPL */

(function(D, store) {
    "use strict";

var JCX = window.JCX = function(config, name) {
    return JCX.api(config, name);
};
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
        if (cfg.cache) {
            promise = promise.then(XHR.cache);
        }
    }

    var always = XHR.chain(cfg.always);
    promise = promise
        .then(always, always)
        .then(XHR.chain(cfg.then), XHR.chain(cfg.catch));

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
        if (prop in xhr) {
            xhr[prop] = cfg[prop];
        }
    }
    if (cfg.mimeType) {
        xhr.overrideMimeType(cfg.mimeType);
    }
    if (cfg.requestedWith !== false) {
        xhr.setRequestHeader('X-Requested-With', cfg.requestedWith || 'XMLHttpRequest');
    }
    if (cfg.json) {
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
    var promise = new Promise(function(resolve, reject) {
        var error = function(e) {
            xhr.error = e;
            reject(xhr);
        };
        xhr.onerror = xhr.ontimeout = error;
        xhr.onloadstart = XHR.start;
        xhr.onload = function() {
            try {
                // cfg status code handling (e.g. {0: 200} for file://)
                var status = cfg[xhr.status] || xhr.status;
                if (typeof status === "function") {
                    status = status(xhr) || xhr.status;
                }
                if (status >= 200 && status < 300) {
                    if (cfg.json && typeof xhr.response !== "object") {
                        XHR.forceJSONResponse(xhr);
                    }
                    resolve(xhr);
                } else {
                    error(status);
                }
            } catch (e) {
                error(e);
            }
        };
        xhr.onloadend = XHR.end;

        try {
            xhr.send(XHR.data(cfg));
        } catch (e) {
            error(e);
        }
    });
    return cfg.retry ? promise.catch(XHR.chain(XHR.retry)) : promise;
};

XHR.forceJSONResponse = function(xhr) {
    try {
        delete xhr.response;
        Object.defineProperty(xhr, 'response', { value: xhr.responseObject, configurable: true });
    } catch (e) {}
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

XHR.properties = {
    responseObject: {
        get: function() {
            var response = null;
            try {
                if (this.responseText) {
                    response = JSON.parse(this.responseText);
                }
            } catch (e) {}
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
        }
        return copy;
    }
};

XHR.chain = function(fn) {
    if (fn) {
        return function chain(xhr) {
            var ret = fn(xhr);
            return ret !== xhr && ret !== undefined ? ret :
                   xhr.error ? Promise.reject(xhr) :
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
var API = JCX.api = function(config, name) {
    return API.build(config, null, name);
};

API.build = function(config, parent, selfName) {
    var fn = function(data) {
        return API.main(fn, data);
    },
    cfg = {
        _fn: fn,
        _parent: parent,
        _private: {}
    };

    if (config.debug || API.get(cfg, 'debug')) {
        fn = cfg._fn = API.debug(selfName||'JCX', fn);
    }
    for (var name in config) {
        API.set(cfg, name, config[name], selfName);
    }

    fn.cfg = cfg;
    fn.config = API.config;
    if (API.get(cfg, 'auto')) {
        setTimeout(fn, 0);
    }
    return fn;
};

API.main = function(fn, data) {
    var cfg = API.getAll(fn.cfg);
    cfg.data = data;
    API.process(cfg, data);
    var deps = cfg.requires;
    if (deps) {
        return Promise.all(deps.map(API.require.bind(cfg))).then(function() {
            return XHR(cfg);
        });
    }
    return XHR(cfg);
};

API.require = function(req) {
    var type = typeof req;
    if (type === 'string') {
        try {
            req = eval(req);
        } catch (e) {
            return Promise.reject(new Error('Could not resolve "'+req+'".'));
        }
    }
    if (type === 'function') {
        var ret = req();
        return Promise.resolve(ret === undefined ? req : ret);
    }
    return req ? Promise.resolve(req) : Promise.reject(req);
};

API.config = function(name, value) {
    return name ?
        value === undefined ?
            API.get(this.cfg, name) :
            API.set(this.cfg, name, value) :
        API.getAll(this.cfg);
};

API.process = function(cfg) {
    if (cfg.preprocess) {
        cfg.preprocess(cfg);
    }
    for (var name in cfg) {
        var value = cfg[name];
        if (typeof value === 'string') {
            value = cfg[name] = API.fill(value, cfg, cfg.data);
        }
    }
};

API.fill = function(string, cfg, data) {
    data = data || {};
    var key,
        str = string,
        re = /\$\{([^}]+)\}/g;
    while ((key = re.exec(string))) {
        key = key[1];
        var val = data[key];
        if (val === null || val === undefined) {
            val = key in cfg ? cfg[key] : '';
        }
        str = str.replace(new RegExp('\\$\\{'+key+'}'), val);
        delete data[key];
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
        if (name.charAt(0) !== '_') {
            if (name.charAt(0) === '!') {
                to[name.substring(1)] = from[name];
            } else {
                to[name] = API.combine(to[name], from[name]);
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
                API.combine(cfg[name], priv[name]);
    if (cfg._parent) {
        return API.combine(API.get(cfg._parent, name, true), value);
    }
    return value;
};

API.set = function(cfg, name, value, parentName) {
    var api = cfg._fn;
    // always bind functions to the cfg
    if (typeof value === "function") {
        value = value.bind(cfg);
        if (API.get(cfg, 'debug')) {
            value = API.debug(
                parentName+(name.charAt(0)==='.'?'':'.')+name,
                value
            );
        }
    }
    if (name.charAt(0) === '.') {
        api[name.substring(1)] = value;
    } else if (name.charAt(0) === '@') {
        api[name.substring(1)] = API.build(value, cfg, name);
    } else if (name.charAt(0) === '_') {
        cfg._private[name.substring(1)] = value;
    } else {
        cfg[name] = value;
    }
};

API.debug = function(name, fn) {
    var console = window.console,
        concat = Array.prototype.concat;
    return function debug(arg) {
        try {
            var ret = fn.apply(this, arguments),
                args = concat.apply([name], arguments);
            if (ret !== undefined && ret !== arg) {
                args.push(ret);
            }
            console.debug.apply(console, args);
            return ret;
        } catch (e) {
            var args = concat.apply([name, e], arguments);
            console.error.apply(console, args);
            throw e;
        }
    };
};

API.combine = function(pval, val) {
    var ptype = API.type(pval),
        type = API.type(val);
    return (
        // ignore null/undefined operands
        !type ? pval :
        !ptype ? val :
        // mismatched types
        type !== ptype ?
            ptype === 'function' ? pval(val) :
            type === 'function' ? val(pval) :
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
        //TODO: reconsider whether falsey return values should be respected
        return fn(pfn(res) || res) || res;
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

JCX.version = "";

})(document, window.store || function(){});
