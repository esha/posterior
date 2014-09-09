/*! jcx - v0.1.4 - 2014-09-08
* http://esha.github.io/jcx/
* Copyright (c) 2014 ESHA Research; Licensed MIT, GPL */

(function(store) {
    "use strict";

var JCX = window.JCX = function(config) {
    return JCX.api(config);
};
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
            xhr.send(typeof cfg.data !== "string" ? JSON.stringify(cfg.data) : null);
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
var API = JCX.api = function() {
    return API.build.apply(this, arguments);
};

API.build = function(config, parent) {
    var fn = function(data) {
        return API.main(fn, data);
    };
    fn.cfg = {
        _fn: fn,
        _parent: parent,
        _private: {}
    };
    fn.config = API.config;
    for (var name in config) {
        API.set(fn.cfg, name, config[name]);
    }
    if (API.get(fn.cfg, 'auto')) {
        setTimeout(fn, 0);
    }
    return fn;
};

API.main = function(fn, data) {
    var cfg = API.getAll(fn.cfg);
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

API.process = function(cfg, data) {
    for (var name in cfg) {
        var value = cfg[name];
        if (typeof value === 'string') {
            value = cfg[name] = API.fill(value, cfg, data);
        }
        // special handling for URLs
        if (name === 'url') {
            while (value.indexOf('..') >= 0) {
                value = value.replace(/[\/\?\&][^\/\.\?\&]+[\/\?\&]?\.\.([\/\?\&]?)/, '$1');
            }
            cfg.url = value;
        }
    }
    cfg.data = cfg.serialize ? cfg.serialize(data) : data;
};

API.fill = function(string, cfg, data) {
    data = data || {};
    var key,
        str = string,
        re = /\{(\w+)\}/g;
    while ((key = re.exec(string))) {
        key = key[1];
        var val = data[key];
        if (val === null || val === undefined) {
            val = key in cfg ? cfg[key] : '';
        }
        str = str.replace(new RegExp('\\{'+key+'}'), val);
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

API.set = function(cfg, name, value) {
    var api = cfg._fn;
    // always bind functions to the cfg
    if (typeof value === "function") {
        if (API.get(cfg, 'debug')) {
            value = function debug() {
                try {
                    var ret = value.apply(cfg, arguments);
                    window.console.debug(name, arguments, ret);
                    return ret;
                } catch (e) {
                    window.console.error(name, arguments, e);
                    throw e;
                }
            };
        } else {
            value = value.bind(cfg);
        }
    }
    if (name.charAt(0) === '.') {
        api[name.substring(1)] = value;
    } else if (name.charAt(0) === '@') {
        api[name.substring(1)] = API.build(value, cfg);
    } else if (name.charAt(0) === '_') {
        cfg._private[name.substring(1)] = value;
    } else {
        cfg[name] = value;
    }
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
