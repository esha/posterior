var _ = JCX._ {
    version: "<%= pkg.version %>",
    build: function(conf, parent, key) {
        var api = function(){ return _.promise.apply(api, arguments); },
            props = api.properties = {
                self: api,
                selfName: key,
                parent: parent
            };
        for (var name in conf) {
            if (conf.hasOwnProperty(name)) {
                var val = conf[name],
                    method = typeof val;
                if (method === 'object') {
                    var child = _.build(val, props, name);
                    api[name] = child;
                    props[name] = child.properties;
                } else {
                    if (method === 'function') {
                        val = val.bind(props);
                    }
                    if (name.charAt(0) === '@') {
                        name = name.substring(1);
                        api[name] = val;
                    }
                    props[name] = val;
                }
            }
        }
        var auto = _.closest(props, 'auto');
        if (auto === true || auto >= 0) {
            setTimeout(api, auto === true ? 0 : auto);
        }
        return api;
    },
    promise: function() {
        var props = this.properties,
            args = slice(arguments),
            then =  [],
            promise = _.closest(props, 'cache') === true && props._promise;

        // extract function arg for implied 'then'
        if (typeof args[args.length-1] === "function") {
            then = args.pop().bind(props);
        }

        if (!promise) {
            // find and resolve configured dependencies, if any
            var deps = _.find(props, 'requires').map(_.resolve);
            if (deps.length) {
                promise = $.when.apply($, deps).then(function() {
                    return _.xhr(props, args, then);
                });
            } else {
                promise = _.xhr(props, args, then);
            }
            props._promise = promise;
        } else if (then) {
            promise.then(then);// won't get status, xhr, opts
        }
        return promise;
    },
    xhr: function(props, args, then) {
        var data = _.config('data', props, args),
            url = _.url(props, data, args),
            method = _.closest(props, 'method');
        if (_.empty(data)) {
            data = undefined;
        }

        var options = _.config('options', props, [method, url, data]);
        if (url && !('url' in options)){ options.url = url; }
        if (method && !('method' in options)){ options.method = method; }
        if (data && !('data' in options)){ options.data = data; }
        if (then) {
            options.then = options.then ? options.then.concat(then) : then;
        }

        var request = _.request(props, options);
        return _.responders(props, request, options);
    },
    request: function(props, options) {
        var minutes = _.closest(props, 'cache');
        if (typeof minutes === "number") {// cache === true is handled by _.promise
            if (!props._cached) {
                props._cacheKey = _.cacheKey(options);
                props._cached = store(props._cacheKey);
            }
            return props._cached ? $.when(props._cached, 'success', null) :
                ajax(options).then(function(json) {
                    store(props._cacheKey, props._cached = json, minutes);
                    setTimeout(function() {
                        delete props._cached;
                    }, minutes * 60000);
                });
        }
        return ajax(options);
    },
    cacheKey: function(options) {
        return options.url + '|' +
            (options.method || 'GET') + '|' +
            (options.data ? JSON.stringify(options.data) : '');
    },
    responders: function(props, promise, options) {
        // each then returns a new promise
        _.find(props, 'then').forEach(function(fn) {
            promise = promise.then(function(result, status, xhr) {
                var args = slice(arguments);
                args.push(options);
                options.result = result;
                options.status = status;
                options.xhr = xhr;
                return fn.apply(props, args);
            });
        });
        _.callback('then', props, promise, options);
        _.callback('fail', props, promise, options);
        _.callback('always', props, promise, options);
        return promise;
    },
    /*TODO: make retry high level, replacing internal xhr sucks
    retrySetup: function(props, xhr, options) {
        var retry = _.closest(props, 'retry');
        if (retry) {
            xhr.fail(function() {
                delete props._xhr;
                props._retryIn = props._retryIn ? props._retryIn * 2 : retry;
                setTimeout(function() {
                    props._xhr = _.request(props, options);
                    _.handlers(props, options);
                }, props._retryIn);
            }).then(function() {
                delete props._retryIn;
            });
        }
    },*/
    callback: function(name, props, xhr, options) {
        var fns = _.find(props, name);
        if (options[name]) {
            fns = fns.concat(options[name]);
        }
        if (fns.length) {
            if (props.prioritize) {// by default callbacks run from wide to narrow
                fns.reverse();
            }
            xhr[name](function() {
                var args = slice(arguments);
                if (args.length === 1) {// when there was a 'then' involved
                    args.push(options.status, name === 'then' ? options.xhr : options.result);
                }
                args.push(options);// give callbacks the usual, plus the conf options
                for (var i=0,m=fns.length; i<m; i++) {
                    if (fns[i].apply(props, args) === false) {
                        break;
                    }
                }
            });
        }
    },
    closest: function(props, property) {
        var override = '='+property;
        if (override in props) {
            return props[override];
        }
        var priv = '_'+property;
        if (priv in props) {
            return props[priv];
        }
        do {
            if (property in props) {
                return props[property];
            }
        } while ((props = props.parent));
    },
    find: function(props, property) {
        var found = [],
            priv = '_'+property,
            override = '='+property;
        if (override in props) {
            _.prepend(props[override], found);
            return found;
        }
        if (priv in props) {
            _.prepend(props[priv], found);
        }
        do {
            if (property in props) {
                _.prepend(props[property], found);
            }
        } while ((props = props.parent));
        return found;
    },
    prepend: function(val, array) {
        if (Array.isArray(val)) {
            array.unshift.apply(array, val);
        } else {
            array.unshift(val);
        }
    },
    config: function(name, props, args) {
        var sources = _.find(props, name),
            config = {};
        for (var i=0,m=sources.length; i<m; i++) {
            var cfg = sources[i];
            if (typeof cfg === "function") {
                cfg = cfg.apply(props, args);
            }
            for (var k in cfg) {
                config[k] = cfg[k];
            }
        }
        return config;
    },
    url: function(props, data, args) {
        var sources = _.find(props, 'url'),
            url = '';
        for (var i=sources.length-1; i>=0; i--) {
            var source = sources[i];
            if (typeof source === "function") {
                url = source.apply(props, data);
                break;
            } else {
                url = source + url;
            }
        }
        while (url.indexOf('..') >= 0) {
            url = url.replace(/[\/\?\&][^\/\.\?\&]+[\/\?\&]?\.\.([\/\?\&]?)/, '$1');
        }
        return _.fill(url, data, args);
    },
    fill: function(url, data, args) {
        data = data || {};
        var key,
            u = url,
            re = /\{(\w+)\}/g;
        while ((key = re.exec(url))) {
            key = key[1];
            var val = data[key];
            if (val === null || val === undefined) {
                val = key in args ? args[key] : '';
            }
            u = u.replace(new RegExp('\\{'+key+'}'), val);
            delete data[key];
        }
        return u;
    },
    empty: function(o) {
        for (var k in o){ return !k; }
        return true;
    },
    refRE: /^([\w\$]+)?((\.[\w\$]+)|\[(\d+|'(\\'|[^'])+'|"(\\"|[^"])+")\])*$/,
    resolve: function(ref) {
        if (_.refRE.test(ref)) {
            ref = eval('window'+(ref.charAt(0) !== '[' ? '.'+ref : ref)) || ref;
        }
        if (typeof ref === "function") {
            ref = ref();
        }
        return ref;
    }
},
slice = Function.prototype.call.bind(Array.prototype.slice),
API = _.build;
API._ = _;
