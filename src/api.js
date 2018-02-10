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
var API = Posterior.api = function(config, name) {
    var parent = config.parent || null;
    if (parent && parent.cfg) {
        parent = parent.cfg;
    }
    return API.build(config, parent, name);
};

// start exposed functions

API.extend = function(config, name) {
  return (this[name || "ext"] = API.build(config, this.cfg, name || "ext"));
};

API.config = function(name, value) {
  return name
    ? value === undefined
        ? API.get(this.cfg, name)
        : API.set(this.cfg, name, value)
    : API.getAll(this.cfg);
};

API.get = function(cfg, name, inheriting) {
  var meta = cfg[name];
  // if no non-private prop
  if (!meta || (inheriting && meta.private)) {
    // oh, and if there's a parent too
    return cfg._parent && API.get(cfg._parent, name, true);
  }
  if (meta) {
    if (meta.root || !cfg._parent) {
      return meta.value;
    }
    return API.combine(API.get(cfg._parent, name, true), meta.value, cfg);
  }
};

// end exposed functions
// start build-time functions

API.build = function(config, parent, name) {
    var fn = function() {
        return API.main(fn, arguments);
    },
    cfg = {
        _fn: fn,
        _parent: parent,
        name: name || 'Posterior'
    };

    if (config.debug || API.get(cfg, 'debug')) {
        fn = cfg._fn = API.debug(cfg.name, fn);
    }
    API.setAll(cfg, config);

    fn.cfg = cfg;
    fn.config = API.config;
    fn.extend = API.extend;
    if (API.get(cfg, 'auto')) {
        setTimeout(fn, 0);
    }
    return fn;
};

API.setAll = function(cfg, config) {
  API.elevate("Children", config);
  API.elevate("Properties", config);
  for (var prop in config) {
    API.set(cfg, prop, config[prop]);
  }
};

API.elevate = function(key, config) {
  if (key in config) {
    var structured = config[key];
    for (var prop in structured) {
      config[prop] = structured[prop];
    }
  }
};

API.set = function(cfg, prop, value) {
  var api = cfg._fn,
    meta = typeof value === "object" && "value" in value
      ? value
      : { value: value };
  meta.name = prop;
  meta.fullname = cfg._parent ? cfg._parent.name + "." + prop : prop;
  // don't require @ for extensions
  if (typeof meta.value === "object" && isCaps(prop)) {
    prop = "@" + prop;
  }
  // identify private, root, and extension config
  while (API.meta.chars.indexOf(prop.charAt(0)) >= 0) {
    API.meta[prop.charAt(0)](meta, cfg);
    prop = prop.substring(1);
  }
  if (typeof meta.value === "function") {
    if (!meta.value.cfg) {
      // if not an extension/sub, bind to cfg
      meta.value = meta.value.bind(cfg);
    }
    if (API.get(cfg, "debug")) {
      // add logging
      meta.value = API.debug(meta.name, meta.value);
    }
  }
  // let config props be accessed from the api function
  if (!(prop in api)) {
    API.getter(api, prop);
  }
  cfg[prop] = meta;
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
  "@": function(meta, cfg) {
    meta.root = true; // extensions are self-combining, so act as roots
    cfg._fn[meta.name] = meta.value = API.build(meta.value, cfg, meta.name);
  }
};

API.getter = function(fn, name) {
  try {
    Object.defineProperty(fn, name, {
      get: function() {
        return API.get(fn.cfg, name);
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

API.getAll = function(cfg, inheriting) {
  var flat = cfg._parent ? API.getAll(cfg._parent, true) : {};
  for (var prop in cfg) {
    // don't copy _fn, or _parent
    if (prop.charAt(0) !== "_") {
      var meta = cfg[prop];
      if (meta.root || prop === "name") {
        // name's are pre-combined
        flat[prop] = meta.value;
      } else if (!inheriting || !meta.private) {
        flat[prop] = API.combine(flat[prop], meta.value, flat);
      }
    }
  }
  return flat;
};

API.process = function(cfg) {
  if (cfg.configure) {
    cfg.configure(cfg);
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
