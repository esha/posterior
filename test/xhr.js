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
    }
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
                this.status = 500;
                this.onerror(data);
            break;
            case 'timeout':
                if (this.ontimeout) {
                    this.ontimeout(data);
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
    });

    test('XHR.promise - part 1', function() {
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

    test('XHR.promise - part 2', function() {
        var xhr = new FakeXHR(),
            cfg = {
                data: 'error'
            };
        XHR.config(xhr, cfg);
        var promise = XHR.promise(xhr, cfg);
        stop();
        promise.catch(function(fake) {
            start();
            equal(xhr.status, 500);
            equal(xhr.error, 'error');
            equal(fake, 'error');
        });
    });

    test('XHR.promise - part 3', function() {
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

}());
