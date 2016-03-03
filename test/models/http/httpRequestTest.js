'use strict';

var assert = require('assert'),
    httpRequest = require('../../../src/models/http/httpRequest'),
    promiseIt = require('../../testHelpers').promiseIt,
    events = require('events'),
    mock = require('../../mock').mock,
    inherit = require('../../../src/util/inherit');

describe('HttpRequest', function () {
    describe('#createFrom', function () {
        var request, container;

        beforeEach(function () {
            request = inherit.from(events.EventEmitter, {
                socket: { remoteAddress: '', remotePort: '' },
                setEncoding: mock(),
                url: 'http://localhost/',
                rawHeaders: []
            });
            container = { request: request };
        });

        promiseIt('should set requestFrom from socket information', function () {
            request.socket = { remoteAddress: 'HOST', remotePort: 'PORT' };

            var promise = httpRequest.createFrom(container).then(function (mbRequest) {
                assert.strictEqual(mbRequest.requestFrom, 'HOST:PORT');
            });

            request.emit('end');

            return promise;
        });

        promiseIt('should echo method from original request', function () {
            request.method = 'METHOD';

            var promise = httpRequest.createFrom(container).then(function (mbRequest) {
                assert.strictEqual(mbRequest.method, 'METHOD');
            });

            request.emit('end');

            return promise;
        });

        promiseIt('should transform rawHeaders from original request, keeping case and merging duplicates', function () {
            request.rawHeaders = ['Accept', 'invalid', 'Accept', 'TEXT/html', 'Host', '127.0.0.1:8000'];

            var promise = httpRequest.createFrom(container).then(function (mbRequest) {
                assert.deepEqual(mbRequest.headers, {
                    Accept: 'TEXT/html',
                    Host: '127.0.0.1:8000'
                });
            });

            request.emit('end');

            return promise;
        });

        promiseIt('should set path and query from request url', function () {
            request.url = 'http://localhost/path?key=value';

            var promise = httpRequest.createFrom(container).then(function (mbRequest) {
                assert.strictEqual(mbRequest.path, '/path');
                assert.deepEqual(mbRequest.query, { key: 'value' });
            });

            request.emit('end');

            return promise;
        });

        promiseIt('should set body from data events', function () {
            var promise = httpRequest.createFrom(container).then(function (mbRequest) {
                assert.strictEqual(mbRequest.body, '12');
            });

            request.emit('data', '1');
            request.emit('data', '2');
            request.emit('end');

            return promise;
        });
    });
});
