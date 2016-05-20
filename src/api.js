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
        API.getter(fn, prop);
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
    if (fn.cfg.savedResult) {
        return Promise.resolve(fn.cfg.savedResult);
    }

    var cfg = API.getAll(fn.cfg);
    // data must be an object or array
    cfg.data = (args.length > 1 || typeof args[0] !== "object") ?
        Array.prototype.slice.call(args) :
        args[0];
    API.process(cfg);
    var promise = API.promise(cfg, fn);

    if (cfg.saveResult) {
        promise.then(function(result) {
            fn.cfg.savedResult = result;
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
            return leader().then(function following(resource) {
                cfg.url = follows && eval('resource.'+follows) || resource;
                return XHR(cfg);
            });
        } else {
            return Promise.reject("Cannot follow link relation without a parent function.");
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
        if (name.charAt(0) !== '_') {
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

API.set = function(cfg, name, value, parentName) {
    var api = cfg._fn,
        subname = parentName+(name.charAt(0)==='.'?'':'.')+name;
    if (typeof value === "function" && API.get(cfg, 'debug')) {
        value = API.debug(subname, value);
    }
    if (name.charAt(0) === '.') {
        api[name.substring(1)] = value;
    } else if (name.charAt(0) === '@') {
        api[name.substring(1)] = API.build(value, cfg, subname);
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
            var args = [name+'('];
            args.push.apply(args, arguments);
            args.push(')');
            var ret = fn.apply(this, arguments);
            if (ret !== undefined && ret !== arg) {
                console.debug.apply(console, [name, '->', ret]);
            }
            return ret;
        } catch (e) {
            var args = concat.apply([name, e], arguments);
            console.error.apply(console, args);
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
