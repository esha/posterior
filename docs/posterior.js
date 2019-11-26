/*! Posterior - v0.22.7 - 2019-11-26
* http://esha.github.io/posterior/
* Copyright (c) 2019 ESHA Research; Licensed MIT */

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
            } else if (cfg.debug === 'capture') {
                XHR.capture('error', xhr, cfg, e);
                reject(e);
            } else {
                reject(xhr.error = e);
            }
        },
        succeed = cfg.debug === 'capture' ?
            function(result) {
                XHR.capture('success', xhr, cfg, result);
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
XHR.capture = function(state, xhr, cfg, data) {
    var fn = cfg._fn;
    fn.capture = {
        state: state,
        method: cfg.method || 'GET',
        status: xhr.status,
        url: API.resolve(cfg.url, cfg.data, null, false),
        requestHeaders: cfg.headers,
        requestData: cfg.data,
        requestBody: cfg.requestBody,
        responseHeaders: xhr.responseHeaders,
        responseBody: xhr.response,
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

/*
'normal': 'standard config, combine w/ancestor'
'_private': 'not to be inherited by descendants'
'!root': 'does not inherit from ancestor'
'@extends': { 'sub API': 'to build' }

requires: [testFn, 'name.of.api']
auto: true//'call async upon build'
follows
singleton
parent

For TypeScript-based config, specify metadata for props explicitly:
'private': {
    private: true,
    value: 'not to be inherited by descendants'
},
'root': {
    root: true,
    value: 'does not inherit from ancestor'
},
// and for extending an API, use Capital props with object values
'Extends': {
    'sub API': 'to build'
}

name, _fn, and _parent are reserved

string values are processed at call-time against data/conf/window
function-function concat results in promise fn wrapper
function-* concat becomes result of calling fn w/* as arg
object concat means copy/merge
string/int concat means usual
boolean concat means &&

*/
var API = Posterior.api = function(inCfg, name) {
    var parent = inCfg.parent || null;
    if (parent && parent.metaCfg) {
        parent = parent.metaCfg;
    }
    return API.build(inCfg, parent, name);
};

// start exposed functions

API.extend = function(inCfg, name) {
  return (this[name || "ext"] = API.build(inCfg, this.metaCfg, name || "ext"));
};

API.config = function(name, value) {
  return name ?
    value === undefined ?
        API.get(this.metaCfg, name) :
        API.set(this.metaCfg, name, value) :
    API.getAll(this.metaCfg);
};

API.get = function(metaCfg, name, inheriting) {
  var meta = metaCfg[name];
  // if no non-private prop
  if (!meta || (inheriting && meta.private)) {
    // oh, and if there's a parent too
    return metaCfg._parent && API.get(metaCfg._parent, name, true);
  }
  if (meta) {
    if (meta.root || !metaCfg._parent) {
      return meta.value;
    }
    return API.combine(API.get(metaCfg._parent, name, true), meta.value, metaCfg);
  }
};

// end exposed functions
// start build-time functions

API.build = function(inCfg, parent, name) {
    var fn = function() {
        return API.main(fn, arguments);
    },
    metaCfg = {
        _fn: fn,
        _parent: parent,
        name: name || 'Posterior'
    };

    if (inCfg.debug || API.get(metaCfg, 'debug')) {
        fn = metaCfg._fn = API.debug(metaCfg.name, fn);
    }
    API.setAll(metaCfg, inCfg);

    fn.metaCfg = metaCfg;
    fn.config = API.config;
    fn.extend = API.extend;
    if (API.get(metaCfg, 'auto')) {
        setTimeout(fn, 0);
    }
    return fn;
};

API.setAll = function(metaCfg, inCfg) {
  API.elevate("Children", inCfg);
  API.elevate("Properties", inCfg);
  for (var prop in inCfg) {
    API.set(metaCfg, prop, inCfg[prop]);
  }
};

API.elevate = function(key, inCfg) {
  if (key in inCfg) {
    var structured = inCfg[key];
    for (var prop in structured) {
      inCfg[prop] = structured[prop];
    }
  }
};

API.set = function(metaCfg, prop, value) {
  var api = metaCfg._fn,
    meta = typeof value === "object" && "value" in value ?
        value :
        { value: value };
  meta.name = prop;
  meta.fullname = metaCfg._parent ? metaCfg._parent.name + "." + prop : prop;
  // don't require @ for extensions
  if (typeof meta.value === "object" && isCaps(prop)) {
    prop = "@" + prop;
  }
  // identify private, root, and extension config
  while (API.meta.chars.indexOf(prop.charAt(0)) >= 0) {
    API.meta[prop.charAt(0)](meta, metaCfg);
    prop = prop.substring(1);
  }
  if (typeof meta.value === "function" && API.get(metaCfg, "debug")) {
    // add logging
    meta.value = API.debug(meta.name, meta.value);
  }
  // let config props be accessed from the api function
  if (!(prop in api)) {
    API.getter(api, prop);
  }
  metaCfg[prop] = meta;
};
function isCaps(s) {
  return s.charAt(0) !== s.charAt(0).toLowerCase();
}

API.meta = {
  chars: "!@_".split(""),
  _: function(meta) {
    meta.private = true;
  },
  "!": function(meta) {
    meta.root = true;
  },
  "@": function(meta, metaCfg) {
    meta.root = true; // extensions are self-combining, so act as roots
    metaCfg._fn[meta.name] = meta.value = API.build(meta.value, metaCfg, meta.name);
  }
};

API.getter = function(fn, name) {
  try {
    Object.defineProperty(fn, name, {
      get: function() {
        return API.get(fn.metaCfg, name);
      },
      configurable: true
    });
  } catch (e) {} // ignore failures
};

API.log = function(args, level) {
  var console = W.console, log = console && console[level || "log"];
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
        args = [name + "("];
        args.push.apply(args, arguments);
        args.push(") resolved to ", ret);
        API.log(args, "debug");
      }
      return ret;
    } catch (e) {
      args = Array.prototype.concat.apply([name, e], arguments);
      API.log(args, "error");
      throw e;
    }
  };
};

// end build-time functions
// start call-time functions

API.main = function(fn, args) {
    if (fn.metaCfg._singletonResult) {
        return Promise.resolve(fn.metaCfg._singletonResult);
    }

    var cfg = API.getAll(fn.metaCfg);
    cfg._fn = fn;
    // data must be an object or array
    cfg._args = args;
    cfg.data = (args.length > 1 || typeof args[0] !== "object") ?
        Array.prototype.slice.call(args) :
        args[0];
    API.process(cfg);
    var promise = API.promise(cfg, fn);

    if (cfg.singleton) {
        promise.then(function(result) {
            fn.metaCfg._singletonResult = result;
        });
    }
    return promise;
};

API.getAll = function(metaCfg, inheriting) {
  var cfg = metaCfg._parent ? API.getAll(metaCfg._parent, true) : {};
  for (var prop in metaCfg) {
    // don't copy _fn, or _parent
    if (prop.charAt(0) !== "_") {
      var meta = metaCfg[prop];
      if (meta.root || prop === "name") {
        // name's are pre-combined
        cfg[prop] = meta.value;
      } else if (!inheriting || !meta.private) {
        cfg[prop] = API.combine(cfg[prop], meta.value, cfg);
      }
    }
  }
  return cfg;
};

API.process = function(cfg) {
  if (cfg.configure) {
    // use meta config as context, pass in run cfg
    cfg.configure.call(cfg._fn.metaCfg, cfg);
  }
  for (var name in cfg) {
    var value = cfg[name];
    if (typeof value === "string") {
      value = cfg[name] = API.resolve(value, cfg.data, cfg, cfg.consumeData);
    }
  }
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
            leader = fn.metaCfg._parent._fn;
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

Posterior.version = "0.22.7";

if (typeof module !== 'undefined' && module.exports) {
    module.exports = Posterior;
} else {
    if (W.Posterior){ Posterior.conflict = W.Posterior; }
    W.Posterior = Posterior;
}

})(window || this);
