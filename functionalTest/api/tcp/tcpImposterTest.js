'use strict';

var assert = require('assert'),
    api = require('../api'),
    tcp = require('./tcpClient'),
    promiseIt = require('../../testHelpers').promiseIt,
    port = api.port + 1,
    timeout = parseInt(process.env.MB_SLOW_TEST_TIMEOUT || 2000);

describe('tcp imposter', function () {
    this.timeout(timeout);

    describe('POST /imposters/:id', function () {
        promiseIt('should auto-assign port if port not provided', function () {
            var request = { protocol: 'tcp', name: this.name };

            return api.post('/imposters', request).then(function (response) {
                assert.strictEqual(response.statusCode, 201);
                assert.ok(response.body.port > 0);
            }).finally(function () {
                return api.del('/imposters');
            });
        });
    });

    describe('GET /imposters/:id', function () {
        promiseIt('should provide access to all requests', function () {
            var request = { protocol: 'tcp', port: port, name: this.name };

            return api.post('/imposters', request).then(function () {
                return tcp.fireAndForget('first', port);
            }).then(function () {
                return tcp.fireAndForget('second', port);
            }).then(function () {
                return api.get('/imposters/' + port);
            }).then(function (response) {
                var requests = response.body.requests.map(function (request) {
                    return request.data;
                });
                assert.deepEqual(requests, ['first', 'second']);
            }).finally(function () {
                return api.del('/imposters');
            });
        });

        promiseIt('should return list of stubs in order', function () {
            var first = { responses: [{ is: { data: '1' }}]},
                second = { responses: [{ is: { data: '2' }}]},
                request = { protocol: 'tcp', port: port, stubs: [first, second], name: this.name };

            return api.post('/imposters', request).then(function () {
                return api.get('/imposters/' + port);
            }).then(function (response) {
                assert.strictEqual(response.statusCode, 200);
                assert.deepEqual(response.body.stubs, [
                    { responses: [{ is: { data: '1' } }] },
                    { responses: [{ is: { data: '2' } }] }
                ]);
            }).finally(function () {
                return api.del('/imposters');
            });
        });

        promiseIt('should reflect default mode', function () {
            var request = { protocol: 'tcp', port: port, name: this.name };

            return api.post('/imposters', request).then(function () {
                return api.get('/imposters/' + port);
            }).then(function (response) {
                assert.strictEqual(response.statusCode, 200);
                assert.deepEqual(response.body, {
                    protocol: 'tcp',
                    port: port,
                    mode: 'text',
                    name: request.name,
                    requests: [],
                    stubs: [],
                    _links: {
                        self: { href: api.url + '/imposters/' + port }
                    }
                });
            }).finally(function () {
                return api.del('/imposters');
            });
        });

        promiseIt('should record matches against stubs', function () {
            var stub = { responses: [{ is: { data: '1' }}, { is: { data: '2' }}]},
                request = { protocol: 'tcp', port: port, stubs: [stub], name: this.name };

            return api.post('/imposters', request).then(function () {
                return tcp.send('first', port);
            }).then(function () {
                return tcp.send('second', port);
            }).then(function () {
                return api.get('/imposters/' + port);
            }).then(function (response) {
                var stubs = JSON.stringify(response.body.stubs),
                    withTimeRemoved = stubs.replace(/"timestamp":"[^"]+"/g, '"timestamp":"NOW"'),
                    withClientPortRemoved = withTimeRemoved.replace(/"requestFrom":"[a-f:\.\d]+"/g, '"requestFrom":"HERE"'),
                    actualWithoutEphemeralData = JSON.parse(withClientPortRemoved);

                assert.deepEqual(actualWithoutEphemeralData, [{
                    responses: [{ is: { data: '1' } }, { is: { data: '2' } }],
                    matches: [
                        {
                            timestamp: 'NOW',
                            request: { requestFrom: 'HERE', data: 'first' },
                            response: { data: '1' }
                        },
                        {
                            timestamp: 'NOW',
                            request: { requestFrom: 'HERE', data: 'second' },
                            response: { data: '2' }
                        }
                    ]
                }]);
            }).finally(function () {
                return api.del('/imposters');
            });
        });
    });
});
