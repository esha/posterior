/*! API(.js) - v0.1.0 - 2013-11-01
* https://github.com/nbubna/API
* Copyright (c) 2013 Nathan Bubna; Licensed MIT */
;(function($, store) {
    "use strict";

    var _ = {
        version: "<%= pkg.version %>",
        typeMap: {
            PATCH: 'POST'
        },
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
                        type = typeof val;
                    if (type === 'object') {
                        var child = _.build(val, props, name);
                        api[name] = child;
                        props[name] = child.properties;
                    } else {
                        if (type === 'function') {
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
                done =  [],
                promise = _.closest(props, 'cache') === true && props._promise;

            // extract function arg for implied 'done'
            if (typeof args[args.length-1] === "function") {
                done = args.pop().bind(props);
            }

            if (!promise) {
                // find and resolve configured dependencies, if any
                var deps = _.find(props, 'requires').map(_.resolve);
                if (deps.length) {
                    promise = $.when.apply($, deps).then(function() {
                        return _.xhr(props, args, done);
                    });
                } else {
                    promise = _.xhr(props, args, done);
                }
                props._promise = promise;
            } else if (done) {
                promise.done(done);// won't get status, xhr, opts
            }
            return promise;
        },
        xhr: function(props, args, done) {
            var data = _.config('data', props, args),
                url = _.url(props, data, args),
                type = _.closest(props, 'type');
            type = _.typeMap[type] || type;
            if (_.empty(data)) {
                data = undefined;
            }

            var options = _.config('options', props, [type, url, data]);
            if (url && !('url' in options)){ options.url = url; }
            if (type && !('type' in options)){ options.type = type; }
            if (data && !('data' in options)){ options.data = data; }
            if (done) {
                options.done = options.done ? options.done.concat(done) : done;
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
                    $.ajax(options).done(function(json) {
                        store(props._cacheKey, props._cached = json, minutes);
                        setTimeout(function() {
                            delete props._cached;
                        }, minutes * 60000);
                    });
            }
            return $.ajax(options);
        },
        cacheKey: function(options) {
            return options.url + '|' +
                (options.type || 'GET') + '|' +
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
            _.callback('done', props, promise, options);
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
                }).done(function() {
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
                        args.push(options.status, name === 'done' ? options.xhr : options.result);
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
        headers: function(xhr) {
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

    // give jQuery a json converter that accepts empty responses
    _.toJSON = $.ajaxSettings.converters["text json"];
    $.ajaxSettings.converters["text json"] = function(s) {
        //if (db.debug) console.log('toJSON', s);
        return s ? _.toJSON.apply(this, arguments) : s;
    };

    if (typeof define === 'function' && define.amd) {
        define(function(){ return API; });
    } else if (typeof module !== 'undefined' && module.exports) {
        module.exports = API;
    } else {
        window.API = API;
        $.ajax.API = API;// alias
    }

}).call(window, window.$, window.store || function(){});