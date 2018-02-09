(function() {
/*
======== A Handy Little QUnit Reference ========
http://api.qunitjs.com/

Test methods:
  module(name, {[setup][ ,teardown]})
  test(name, callback)
  expect(numberOfAssertions)
  stop(increment)
  start(decrement)
Test assertions:
  ok(value, [message])
  equal(actual, expected, [message])
  notEqual(actual, expected, [message])
  deepEqual(actual, expected, [message])
  notDeepEqual(actual, expected, [message])
  strictEqual(actual, expected, [message])
  notStrictEqual(actual, expected, [message])
  throws(block, [expected], [message])
*/
    module("xhr");
    var XHR = Posterior.xhr,
        API = Posterior.api;

    test("API exists", function() {
        ok(XHR);
        ok('responseObject' in XMLHttpRequest.prototype);
        ok('responseHeaders' in XMLHttpRequest.prototype);
    });

    function FakeXHR() {
        this._headers = {};
        this.id = ++FakeXHR._id;
    }
    FakeXHR._id = 0;
    FakeXHR.prototype.timeout = null;
    FakeXHR.prototype.open = function(method, url, async, user, pass) {
        this._method = method;
        this._url = url;
        this._async = async;
        this._username = user;
        this._password = pass;
    };
    FakeXHR.prototype.addEventListener = function(event, fn) {
        event = 'on'+event;
        if (event in this) {
            fn = API.combineFn(this[event], fn);
        }
        this[event] = fn;
    };
    FakeXHR.prototype.getAllResponseHeaders = function() {
        var all = '';
        for (var header in this._headers) {
            all += header + ': ' + this._headers[header] + '\n';
        }
        return all;
    };
    FakeXHR.prototype.overrideMimeType = function(type) {
        this._mimeType = type;
    };
    FakeXHR.prototype.setRequestHeader = function(name, value) {
        this._headers[name] = value;
    };
    FakeXHR.prototype.send = function(data) {
        if (this.onloadstart) {
            this.onloadstart();
        }
        switch (data) {
            case 'error':
                this.status = 0;
                this.onerror(data);
            break;
            case 'clienterror':
                this.status = 404;
                this.responseText = "Not found";
                this.onload();
            break;
            case 'servererror':
                this.status = 500;
                this.responseText = "Internal server error";
                this.onload();
            break;
            case 'timeout':
                if (this.ontimeout) {
                    this.ontimeout(data);
                }
            break;
            case 'retry':
                if (FakeXHR.retries) {
                    FakeXHR.retries -= 1;
                    this.status = 405;
                    this.onerror(data);
                } else {
                    this.status = 200;
                    this.responseText = this.cfg.response || 'retried';
                    this.onload();
                }
            break;
            default:
                this.status = 200;
                this.responseText = this.cfg.response || data;
                this.onload();
            break;
        }
        if (this.onloadend) {
            this.onloadend();
        }
    };
    Object.defineProperties(FakeXHR.prototype, XHR.properties);

    test('XHR.main', function() {
        expect(9);
        XHR.ctor = FakeXHR;
        var promise;
        promise = XHR({
            url: '/main',
            responseData: function(res) {
                ok(this instanceof FakeXHR, 'context should be xhr');
                res.altered = true;
            },
            response: '{"json":true}',
            load: function() {
                equal(this._url, '/main', 'load right url');
                equal(this._method, 'GET', 'load right method');
                deepEqual(this.responseText, '{"json":true}', 'response not parsed or altered yet');
            }
        });
        ok(promise instanceof Promise, 'should have promise');
        ok(promise.xhr instanceof FakeXHR, 'promise.xhr should be fake');
        stop();
        promise.then(function(response) {
            start();
            ok(response.json, 'should get json response');
            ok(response.altered, 'should be altered');
            equal(promise.xhr.response, response, 'arg should be xhr.response');
        }).catch(function(e) {
            start();
            ok(!e, e);
        });
        XHR.ctor = XMLHttpRequest;
    });

    test('XHR.config', function() {
        var xhr = new FakeXHR(),
            cfg = {
                url: '/foo/../bar',
                username: 'test',
                password: 'this',
                mimeType: 'application/json',
                requestedWith: false,
                headers: {
                    Whatever: 'You Want'
                },
                timeout: 2000,
                ignoreme: 'ignored'
            };
        XHR.config(xhr, cfg);
        strictEqual(xhr.cfg, cfg);
        equal(xhr._url, '/bar');
        equal(xhr._method, 'GET');
        strictEqual(xhr._async, true);
        equal(xhr._username, 'test');
        equal(xhr._password, 'this');
        equal(xhr._mimeType, 'application/json');
        strictEqual(xhr._headers['X-Requested-With'], undefined);
        equal(xhr.responseType, 'json');
        equal(xhr._headers.Accept, 'application/json');
        equal(xhr._headers['Content-Type'], 'application/json');
        equal(xhr._headers.Whatever, 'You Want');
        strictEqual(xhr.ignoreme, undefined);
        strictEqual(xhr.timeout, cfg.timeout);

        cfg = {
            url: '/',
            method: 'POST',
            json: false,
            async: false
        };
        xhr = new FakeXHR();
        XHR.config(xhr, cfg);
        strictEqual(xhr._async, false);
        equal(xhr._method, 'POST');
        equal(xhr._headers['X-Requested-With'], 'XMLHttpRequest');
        strictEqual(xhr._headers.Accept, undefined);

        // make sure headers aren't stomped on by defaulting to json:true
        var testType = 'application/test';
        cfg = {
            url: '/',
            method: 'POST',
            headers: {
                'Accept': testType,
                'Content-Type': testType
            }
        };
        xhr = new FakeXHR();
        XHR.config(xhr, cfg);
        strictEqual(xhr._headers.Accept, testType);
        strictEqual(xhr._headers['Content-Type'], testType);
    });

    test('XHR.promise - success', function() {
        var xhr = new FakeXHR(),
            cfg = {
                data: { test: true }
            };
        XHR.config(xhr, cfg);
        var promise = XHR.promise(xhr, cfg);
        ok(promise instanceof Promise);
        stop();
        promise.then(function(fake) {
            start();
            equal(xhr.status, 200);
            deepEqual(fake, xhr.responseObject);
            deepEqual(fake, { test: true });
        });
    });

    test('XHR.promise - network error', function() {
        var xhr = new FakeXHR(),
            cfg = {
                data: 'error'
            };
        XHR.config(xhr, cfg);
        var promise = XHR.promise(xhr, cfg);
        stop();
        promise.catch(function(fake) {
            start();
            ok(!xhr.status);
            equal(xhr.error, 'error');
            equal(fake, 'error');
        });
    });

    test('XHR.promise - network timeout', function() {
        var xhr = new FakeXHR(),
            cfg = {
                data: 'timeout',
                timeout: 200
            };
        XHR.config(xhr, cfg);
        var promise = XHR.promise(xhr, cfg);
        stop();
        promise.catch(function(fake) {
            start();
            ok(!xhr.status);
            equal(fake, 'timeout');
        });
    });

    test('XHR.promise - client error', function() {
        var xhr = new FakeXHR(),
            cfg = {
                data: 'clienterror',
                failure: function(status, _xhr) {
                    strictEqual(xhr, _xhr);
                    strictEqual(this, cfg);
                    equal(status, xhr.status);
                    return 'failed';
                }
            };
        XHR.config(xhr, cfg);
        var promise = XHR.promise(xhr, cfg);
        stop();
        promise.catch(function(fake) {
            start();
            equal(xhr.status, 404);
            equal(xhr.responseText, 'Not found');
            equal(fake, 'failed');
        });
    });

    test('XHR.promise - server error', function() {
        var xhr = new FakeXHR(),
            cfg = {
                data: 'servererror',
                failure: function(status, _xhr) {
                    strictEqual(xhr, _xhr);
                    strictEqual(this, cfg);
                    equal(status, xhr.status);
                    return 'failed';
                }
            };
        XHR.config(xhr, cfg);
        var promise = XHR.promise(xhr, cfg);
        stop();
        promise.catch(function(fake) {
            start();
            equal(xhr.status, 500);
            equal(xhr.responseText, 'Internal server error');
            equal(fake, 'failed');
        });
    });

    test('XHR.method', function() {
        var cfg = {method:'PATCH'};
        equal(XHR.method(cfg), 'POST');
        equal(XHR.method({}), 'GET');
        cfg.method = 'DELETE';
        equal(XHR.method(cfg), 'DELETE');
    });

    test('XHR.isData', function() {
        ok(XHR.isData({}), 'object is data');
        ok(XHR.isData(0), '0 is data');
        ok(!XHR.isData(''), 'empty string is not data');
        ok(XHR.isData(false), 'false is data');
        ok(!XHR.isData(undefined), 'undefined is not data');
        ok(XHR.isData(null), 'null is data');
    });

    test('XHR.data', function() {
        var cfg = { data: true };
        strictEqual(XHR.data(cfg), 'true');
        cfg = { data: {json:'yep'}};
        strictEqual(XHR.data(cfg), '{"json":"yep"}');
        cfg = {data : 0, requestData: function(data){ return data ? data : ''; }};
        strictEqual(XHR.data(cfg), '');
    });

    test('XHR.start/end', function() {
        equal(XHR.active, 0);
        equal(XHR.activeClass, 'xhr-active');
        var htmlClass = document.documentElement.classList;
        ok(!htmlClass.contains(XHR.activeClass));
        XHR.start();
        ok(htmlClass.contains(XHR.activeClass));
        equal(XHR.active, 1);
        XHR.start();
        equal(XHR.active, 2);
        XHR.end();
        equal(XHR.active, 1);
        ok(htmlClass.contains(XHR.activeClass));
        XHR.end();
        equal(XHR.active, 0);
        ok(!htmlClass.contains(XHR.activeClass));
    });

    test('XHR.url', function() {
        var cfg = { url: 'foo/../bar' };
        equal(XHR.url(cfg), 'bar');
    });

    test('XHR.key', function() {
        var cfg = { url: '/x/../test', method:'PATCH', data: {test:2.2} };
        equal(XHR.key(cfg), '/test|POST|{"test":2.2}');
    });

    test('XHR.safeCopy', function() {
        var xhr = {
            good: true,
            bad: function(){}
        };
        Object.defineProperty(xhr, 'evil', {
            get: function() {
                throw 'BWAHAHAHA';
            },
            enumerable: true
        });
        deepEqual(XHR.safeCopy(xhr), {good:true}, 'should not copy functions');

        xhr = { nest: { bad: false } };
        xhr.nest.parent = xhr;
        deepEqual(XHR.safeCopy(xhr), {nest:{bad:false}}, 'should not copy circular refs');
    });

    test('XHR.forceJSONResponse', function() {
        var xhr = new FakeXHR();
        xhr.responseText = '{"foo":true}';
        Object.defineProperty(xhr, 'response', {
            value: xhr.responseText,
            configurable: true,
            writable: false
        });

        try {
            xhr.response = 'fail';
        } catch (e) {}
        strictEqual(xhr.response, xhr.responseText);
        XHR.forceJSONResponse(xhr);
        deepEqual(xhr.response, {foo:true});
        strictEqual(xhr.responseObject, xhr.response);
    });

    test("XHR caching", function() {
        expect(5);

        // setup
        var subsequentCall = false,
        cfg = {
            cache: true,
            url: 'cache-test',
            then: function() {
                if (subsequentCall) {
                    start();
                }
                ok(true, 'running then');
            }
        },
        XHRpromise = XHR.promise;
        XHR.promise = function() {
            // return fake resolved promise that's synchronous
            return {
                then: function(fn) {
                    XHR.promise = XHRpromise;
                    ok(true, 'once for cfg.then, once for cfg.cache');
                    fn();
                    return this;
                }
            };
        };

        // first call
        XHR.main(cfg);
        ok(store.has(XHR.key(cfg)), "xhr cached in localStorage");

        // this should trigger only one more assertion, not two
        subsequentCall = true;
        stop();
        XHR.main(cfg);

        // clean up
        store.remove(XHR.key(cfg));
    });

    test('XHR retry', function() {
        expect(10);
        XHR.ctor = FakeXHR;
        FakeXHR.retries = 3;
        var fails = 0,
            actualSetTimeout = window.setTimeout,
            expectedWaits = [8000, 4000, 2000];
        // async testing is tangential, force sync behavior
        window.setTimeout = function(fn, wait) {
            //NOTE: if/else exists only to workaround PhantomJS mysterious setTimeout call during this test
            if (wait > 0) {
                equal(wait, expectedWaits.pop(), "should have increasing wait time");
                fn();
            } else {
                actualSetTimeout(fn, wait);
            }
        };
        XHR({
            url: '/fake',
            retry: true,
            data: 'retry',// tells FakeXHR to fail until retries are over
            error: function(err) {
                equal(err, 'retry');
                equal(FakeXHR.retries, 2-fails, "should be "+(2-fails)+" retries left");
                fails++;
            },
            load: function() {
                equal(this.responseText, 'retried');
            }
        });
        XHR.ctor = XMLHttpRequest;
        window.setTimeout = actualSetTimeout;
    });

    test('XHR throttle', function() {
        expect(14);
        // setup
        var XHRrun = XHR.run,
            actualSetTimeout = window.setTimeout,
            xhr = { fake: true },
            cfg = {
                throttle: { key: 'test', ms: 200 }
            };
        XHR.run = function(_xhr, _cfg, events, fail) {
            strictEqual(xhr, _xhr, 'gets xhr');
            strictEqual(cfg, _cfg, 'gets cfg');
            equal(typeof events, 'object', 'gets events obj');
            equal(typeof fail, 'function', 'gets fail fn');
        };
        window.setTimeout = function fakeTimeout(fn, wait) {
            ok(XHR.throttles.test.queue > 0, 'queue must be > 0 when waiting');
            ok(wait >= 10, 'wait of ~0 is unnecessary async');
            fn();// don't actually wait
        };

        // test
        XHR.promise(xhr, cfg);
        ok(XHR.throttles, 'has record of throttles');
        ok(XHR.throttles['test'], 'has test record');
        equal(XHR.throttles.test.queue, 0, 'first run should not go async');
        ok(XHR.throttles.test.lastRun, 'recorded time of run');
        XHR.promise(xhr, cfg);

        // cleanup
        XHR.run = XHRrun;
        window.setTimeout = actualSetTimeout;
    });

    test('XHR.remember', function() {
        var cfg = {
            name: 'Test',
            url: '/test',
            _fn: function Test(){},
        };
        XHR.remember('response', new FakeXHR(), cfg, 'value');
        var testDebug = function(debug, checkDefined) {
            ok(debug instanceof Object, 'should have debug object');
            equal(typeof debug.stage, 'string', 'debug.stage should be string');
            equal(typeof debug.method, "string", "debug.method should be string");
            equal(typeof debug.url, "string", "debug.url should be string");
            if (checkDefined) {
                ok('status' in debug, "status should be defined");
                ok('requestHeaders' in debug, 'requestHeaders should be defined');
                ok('requestData' in debug, 'requestData should be defined');
                ok('responseHeaders' in debug, 'responseHeaders should be defined');
            }
            equal(debug.responseData, 'value', 'responseData should be value');
        };
        testDebug(cfg._fn.debug);
        ok(store.has(cfg.name + ".debug"), "debug should be stored");
        testDebug(store.get(cfg.name+".debug"), false);

        // clean up
        store.remove(cfg.name+'.debug');
    });

}());
