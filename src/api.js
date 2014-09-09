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
        fn = API.debug(selfName||'JCX', fn);
    }
    for (var name in config) {
        API.set(cfg, name, config[name], selfName+'.');
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
    }
    cfg.data = data;
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

API.set = function(cfg, name, value, prefix) {
    var api = cfg._fn;
    // always bind functions to the cfg
    if (typeof value === "function") {
        value = value.bind(cfg);
        if (API.get(cfg, 'debug')) {
            value = API.debug(prefix+name, value);
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