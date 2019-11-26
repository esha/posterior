(function() {
/*
======== A Handy Little QUnit Reference ========
http://api.qunitjs.com/

Test methods:
  QUnit.module(name, {[setup][ ,teardown]})
  QUnit.test(name, callback)
  assert.expect(numberOfAssertions)
  stop(increment)
  start(decrement)
Test assertions:
  assert.ok(value, [message])
  assert.equal(actual, expected, [message])
  assert.notEqual(actual, expected, [message])
  assert.deepEqual(actual, expected, [message])
  notDeepEqual(actual, expected, [message])
  assert.strictEqual(actual, expected, [message])
  notStrictEqual(actual, expected, [message])
  throws(block, [expected], [message])
*/
    QUnit.module("xhr");
    var XHR = Posterior.xhr,
        API = Posterior.api;

    QUnit.test("API exists", function(assert) {
        assert.ok(XHR);
        assert.ok('responseObject' in XMLHttpRequest.prototype);
        assert.ok('responseHeaders' in XMLHttpRequest.prototype);
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

    QUnit.test('XHR.main', function(assert) {
        assert.expect(10);
        XHR.ctor = FakeXHR;
        var promise;
        promise = XHR({
            url: '/main',
            responseData: function(res, xhr) {
                assert.ok(this instanceof Object && 'url' in this, 'context should be cfg');
                assert.ok(xhr instanceof FakeXHR, '2nd arg should be xhr');
                res.altered = true;
            },
            response: '{"json":true}',
            load: function() {
                assert.equal(this._url, '/main', 'load right url');
                assert.equal(this._method, 'GET', 'load right method');
                assert.deepEqual(this.responseText, '{"json":true}', 'response not parsed or altered yet');
            }
        });
        assert.ok(promise instanceof Promise, 'should have promise');
        assert.ok(promise.xhr instanceof FakeXHR, 'promise.xhr should be fake');
        var done = assert.async();
        promise.then(function(response) {
            done();
            assert.ok(response.json, 'should get json response');
            assert.ok(response.altered, 'should be altered');
            assert.equal(promise.xhr.response, response, 'arg should be xhr.response');
        }).catch(function(e) {
            done();
            assert.ok(!e, e);
        });
        XHR.ctor = XMLHttpRequest;
    });

    QUnit.test('XHR.config', function(assert) {
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
        assert.strictEqual(xhr.cfg, cfg);
        assert.equal(xhr._url, '/bar');
        assert.equal(xhr._method, 'GET');
        assert.strictEqual(xhr._async, true);
        assert.equal(xhr._username, 'test');
        assert.equal(xhr._password, 'this');
        assert.equal(xhr._mimeType, 'application/json');
        assert.strictEqual(xhr._headers['X-Requested-With'], undefined);
        assert.equal(xhr.responseType, 'json');
        assert.equal(xhr._headers.Accept, 'application/json');
        assert.equal(xhr._headers['Content-Type'], 'application/json');
        assert.equal(xhr._headers.Whatever, 'You Want');
        assert.strictEqual(xhr.ignoreme, undefined);
        assert.strictEqual(xhr.timeout, cfg.timeout);

        cfg = {
            url: '/',
            method: 'POST',
            json: false,
            async: false
        };
        xhr = new FakeXHR();
        XHR.config(xhr, cfg);
        assert.strictEqual(xhr._async, false);
        assert.equal(xhr._method, 'POST');
        assert.equal(xhr._headers['X-Requested-With'], 'XMLHttpRequest');
        assert.strictEqual(xhr._headers.Accept, undefined);

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
        assert.strictEqual(xhr._headers.Accept, testType);
        assert.strictEqual(xhr._headers['Content-Type'], testType);
    });

    QUnit.test('XHR.promise - success', function(assert) {
        var xhr = new FakeXHR(),
            cfg = {
                data: { test: true }
            };
        XHR.config(xhr, cfg);
        var promise = XHR.promise(xhr, cfg);
        assert.ok(promise instanceof Promise);
        var done = assert.async();
        promise.then(function(fake) {
            done();
            assert.equal(xhr.status, 200);
            assert.deepEqual(fake, xhr.responseObject);
            assert.deepEqual(fake, { test: true });
        });
    });

    QUnit.test('XHR.promise - network error', function(assert) {
        var xhr = new FakeXHR(),
            cfg = {
                data: 'error'
            };
        XHR.config(xhr, cfg);
        var promise = XHR.promise(xhr, cfg);
        var done = assert.async();
        promise.catch(function(fake) {
            done();
            assert.ok(!xhr.status);
            assert.equal(xhr.error, 'error');
            assert.equal(fake, 'error');
        });
    });

    QUnit.test('XHR.promise - network timeout', function(assert) {
        var xhr = new FakeXHR(),
            cfg = {
                data: 'timeout',
                timeout: 200
            };
        XHR.config(xhr, cfg);
        var promise = XHR.promise(xhr, cfg);
        var done = assert.async();
        promise.catch(function(fake) {
            done();
            assert.ok(!xhr.status);
            assert.equal(fake, 'timeout');
        });
    });

    QUnit.test('XHR.promise - client error', function(assert) {
        var xhr = new FakeXHR(),
            cfg = {
                data: 'clienterror',
                failure: function(status, _xhr) {
                    assert.strictEqual(xhr, _xhr);
                    assert.strictEqual(this, cfg);
                    assert.equal(status, xhr.status);
                    return 'failed';
                }
            };
        XHR.config(xhr, cfg);
        var promise = XHR.promise(xhr, cfg);
        var done = assert.async();
        promise.catch(function(fake) {
            done();
            assert.equal(xhr.status, 404);
            assert.equal(xhr.responseText, 'Not found');
            assert.equal(fake, 'failed');
        });
    });

    QUnit.test('XHR.promise - server error', function(assert) {
        var xhr = new FakeXHR(),
            cfg = {
                data: 'servererror',
                failure: function(status, _xhr) {
                    assert.strictEqual(xhr, _xhr);
                    assert.strictEqual(this, cfg);
                    assert.equal(status, xhr.status);
                    return 'failed';
                }
            };
        XHR.config(xhr, cfg);
        var promise = XHR.promise(xhr, cfg);
        var done = assert.async();
        promise.catch(function(fake) {
            done();
            assert.equal(xhr.status, 500);
            assert.equal(xhr.responseText, 'Internal server error');
            assert.equal(fake, 'failed');
        });
    });

    QUnit.test('XHR.method', function(assert) {
        var cfg = {method:'PATCH'};
        assert.equal(XHR.method(cfg), 'POST');
        assert.equal(XHR.method({}), 'GET');
        cfg.method = 'DELETE';
        assert.equal(XHR.method(cfg), 'DELETE');
    });

    QUnit.test('XHR.isData', function(assert) {
        assert.ok(XHR.isData({}), 'object is data');
        assert.ok(XHR.isData(0), '0 is data');
        assert.ok(!XHR.isData(''), 'empty string is not data');
        assert.ok(XHR.isData(false), 'false is data');
        assert.ok(!XHR.isData(undefined), 'undefined is not data');
        assert.ok(XHR.isData(null), 'null is data');
    });

    QUnit.test('XHR.data', function(assert) {
        var cfg = { data: true };
        assert.strictEqual(XHR.data(cfg), 'true');
        cfg = { data: {json:'yep'}};
        assert.strictEqual(XHR.data(cfg), '{"json":"yep"}');
        cfg = {data : 0, requestData: function(data){ return data ? data : ''; }};
        assert.strictEqual(XHR.data(cfg), '');
    });

    QUnit.test('XHR.start/end', function(assert) {
        assert.equal(XHR.active, 0);
        assert.equal(XHR.activeClass, 'xhr-active');
        var htmlClass = document.documentElement.classList;
        assert.ok(!htmlClass.contains(XHR.activeClass));
        XHR.start();
        assert.ok(htmlClass.contains(XHR.activeClass));
        assert.equal(XHR.active, 1);
        XHR.start();
        assert.equal(XHR.active, 2);
        XHR.end();
        assert.equal(XHR.active, 1);
        assert.ok(htmlClass.contains(XHR.activeClass));
        XHR.end();
        assert.equal(XHR.active, 0);
        assert.ok(!htmlClass.contains(XHR.activeClass));
    });

    QUnit.test('XHR.url', function(assert) {
        var cfg = { url: 'foo/../bar' };
        assert.equal(XHR.url(cfg), 'bar');
    });

    QUnit.test('XHR.key', function(assert) {
        var cfg = { url: '/x/../test', method:'PATCH', data: {test:2.2} };
        assert.equal(XHR.key(cfg), '/test|POST|{"test":2.2}');
    });

    QUnit.test('XHR.safeCopy', function(assert) {
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
        assert.deepEqual(XHR.safeCopy(xhr), {good:true}, 'should not copy functions');

        xhr = { nest: { bad: false } };
        xhr.nest.parent = xhr;
        assert.deepEqual(XHR.safeCopy(xhr), {nest:{bad:false}}, 'should not copy circular refs');
    });

    QUnit.test('XHR.forceJSONResponse', function(assert) {
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
        assert.strictEqual(xhr.response, xhr.responseText);
        XHR.forceJSONResponse(xhr);
        assert.deepEqual(xhr.response, {foo:true});
        assert.strictEqual(xhr.responseObject, xhr.response);
    });

    QUnit.test("XHR caching", function(assert) {
        assert.expect(5);

        // setup
        var subsequentCall = false,
            done,
        cfg = {
            cache: true,
            url: 'cache-test',
            then: function() {
                if (subsequentCall) {
                    done();
                }
                assert.ok(true, 'running then');
            }
        },
        XHRpromise = XHR.promise;
        XHR.promise = function() {
            // return fake resolved promise that's synchronous
            return {
                then: function(fn) {
                    XHR.promise = XHRpromise;
                    assert.ok(true, 'once for cfg.then, once for cfg.cache');
                    fn();
                    return this;
                }
            };
        };

        // first call
        XHR.main(cfg);
        assert.ok(store.has(XHR.key(cfg)), "xhr cached in localStorage");

        // this should trigger only one more assertion, not two
        subsequentCall = true;
        done = assert.async();
        XHR.main(cfg);

        // clean up
        store.remove(XHR.key(cfg));
    });

    QUnit.test('XHR retry', function(assert) {
        assert.expect(10);
        XHR.ctor = FakeXHR;
        FakeXHR.retries = 3;
        var fails = 0,
            actualSetTimeout = window.setTimeout,
            expectedWaits = [8000, 4000, 2000];
        // async testing is tangential, force sync behavior
        window.setTimeout = function(fn, wait) {
            //NOTE: if/else exists only to workaround PhantomJS mysterious setTimeout call during this test
            if (wait > 0) {
                assert.equal(wait, expectedWaits.pop(), "should have increasing wait time");
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
                assert.equal(err, 'retry');
                assert.equal(FakeXHR.retries, 2-fails, "should be "+(2-fails)+" retries left");
                fails++;
            },
            load: function() {
                assert.equal(this.responseText, 'retried');
            }
        });
        XHR.ctor = XMLHttpRequest;
        window.setTimeout = actualSetTimeout;
    });

    QUnit.test('XHR throttle', function(assert) {
        assert.expect(14);
        // setup
        var XHRrun = XHR.run,
            actualSetTimeout = window.setTimeout,
            xhr = { fake: true },
            cfg = {
                throttle: { key: 'test', ms: 200 }
            };
        XHR.run = function(_xhr, _cfg, events, fail) {
            assert.strictEqual(xhr, _xhr, 'gets xhr');
            assert.strictEqual(cfg, _cfg, 'gets cfg');
            assert.equal(typeof events, 'object', 'gets events obj');
            assert.equal(typeof fail, 'function', 'gets fail fn');
        };
        window.setTimeout = function fakeTimeout(fn, wait) {
            assert.ok(XHR.throttles.test.queue > 0, 'queue must be > 0 when waiting');
            assert.ok(wait >= 10, 'wait of ~0 is unnecessary async');
            fn();// don't actually wait
        };

        // test
        XHR.promise(xhr, cfg);
        assert.ok(XHR.throttles, 'has record of throttles');
        assert.ok(XHR.throttles['test'], 'has test record');
        assert.equal(XHR.throttles.test.queue, 0, 'first run should not go async');
        assert.ok(XHR.throttles.test.lastRun, 'recorded time of run');
        XHR.promise(xhr, cfg);

        // cleanup
        XHR.run = XHRrun;
        window.setTimeout = actualSetTimeout;
    });

    QUnit.test('XHR.capture', function(assert) {
        var cfg = {
            name: 'Test',
            url: '/test',
            requestBody: 'notempty',
            _fn: function test(){},
        };
        XHR.capture('success', new FakeXHR(), cfg, 'value');
        var testCapture = function(capture, checkDefined) {
            assert.equal(capture.state, 'success', 'state should be as passed to XHR.capture');
            assert.ok(capture instanceof Object, 'should have capture object');
            assert.equal(typeof capture.method, "string", "capture.method should be string");
            assert.equal(typeof capture.url, "string", "capture.url should be string");
            if (checkDefined) {
                assert.ok('status' in capture, "status should be defined");
                assert.ok('requestHeaders' in capture, 'requestHeaders should be defined');
                assert.ok('requestData' in capture, 'requestData should be defined');
                assert.ok('responseHeaders' in capture, 'responseHeaders should be defined');
                assert.ok("responseBody" in capture, "responseBody should be defined");
            }
            assert.equal(capture.requestBody, 'notempty', "requestBody should be 'notempty'");
            assert.equal(capture.responseData, 'value', 'responseData should be value');
        };
        testCapture(cfg._fn.capture);
    });

}());
