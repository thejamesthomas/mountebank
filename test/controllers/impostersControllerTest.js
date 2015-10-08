'use strict';

var assert = require('assert'),
    mock = require('../mock').mock,
    Controller = require('../../src/controllers/impostersController'),
    FakeResponse = require('../fakes/fakeResponse'),
    Q = require('q'),
    promiseIt = require('../testHelpers').promiseIt;

describe('ImpostersController', function () {
    var response;

    beforeEach(function () {
        response = FakeResponse.create();
    });

    describe('#get', function () {
        it('should send an empty array if no imposters', function () {
            var controller = Controller.create({}, {});

            controller.get({ url: '/imposters' }, response);

            assert.deepEqual(response.body, {imposters: []});
        });

        it('should send list JSON for all imposters by default', function () {
            var firstImposter = { toJSON: mock().returns('firstJSON') },
                secondImposter = { toJSON: mock().returns('secondJSON') },
                controller = Controller.create({}, { 1: firstImposter, 2: secondImposter });

            controller.get({ url: '/imposters' }, response);

            assert.deepEqual(response.body, {imposters: ['firstJSON', 'secondJSON']});
            assert.ok(firstImposter.toJSON.wasCalledWith({ replayable: false, removeProxies: false, list: true }), firstImposter.toJSON.message());
            assert.ok(secondImposter.toJSON.wasCalledWith({ replayable: false, removeProxies: false, list: true }), secondImposter.toJSON.message());
        });

        it('should send replayable JSON for all imposters if querystring present', function () {
            var firstImposter = { toJSON: mock().returns('firstJSON') },
                secondImposter = { toJSON: mock().returns('secondJSON') },
                controller = Controller.create({}, { 1: firstImposter, 2: secondImposter });

            controller.get({ url: '/imposters?replayable=true' }, response);

            assert.deepEqual(response.body, {imposters: ['firstJSON', 'secondJSON']});
            assert.ok(firstImposter.toJSON.wasCalledWith({ replayable: true, removeProxies: false, list: false }), firstImposter.toJSON.message());
            assert.ok(secondImposter.toJSON.wasCalledWith({ replayable: true, removeProxies: false, list: false }), secondImposter.toJSON.message());
        });

        it('should send replayable and removeProxies JSON for all imposters if querystring present', function () {
            var firstImposter = { toJSON: mock().returns('firstJSON') },
                secondImposter = { toJSON: mock().returns('secondJSON') },
                controller = Controller.create({}, { 1: firstImposter, 2: secondImposter });

            controller.get({ url: '/imposters?replayable=true&removeProxies=true' }, response);

            assert.deepEqual(response.body, {imposters: ['firstJSON', 'secondJSON']});
            assert.ok(firstImposter.toJSON.wasCalledWith({ replayable: true, removeProxies: true, list: false }), firstImposter.toJSON.message());
            assert.ok(secondImposter.toJSON.wasCalledWith({ replayable: true, removeProxies: true, list: false }), secondImposter.toJSON.message());
        });
    });

    describe('#post', function () {
        var request, Imposter, imposter, imposters, Protocol, controller, logger;

        beforeEach(function () {
            request = { body: {}, socket: { remoteAddress: 'host', remotePort: 'port' } };
            imposter = {
                url: mock().returns('imposter-url'),
                toJSON: mock().returns('JSON')
            };
            Imposter = {
                create: mock().returns(Q(imposter))
            };
            imposters = {};
            Protocol = {
                name: 'http',
                Validator: {
                    create: mock().returns({ validate: mock().returns(Q({ isValid: true })) })
                }
            };
            logger = { debug: mock(), warn: mock() };
            controller = Controller.create({ 'http': Protocol }, imposters, Imposter, logger);
        });

        promiseIt('should return a 201 with the Location header set', function () {
            request.body = { port: 3535, protocol: 'http' };

            return controller.post(request, response).then(function () {
                assert(response.headers.Location, 'http://localhost/servers/3535');
                assert.strictEqual(response.statusCode, 201);
            });
        });

        promiseIt('should return imposter JSON', function () {
            request.body = { port: 3535, protocol: 'http' };

            return controller.post(request, response).then(function () {
                assert.strictEqual(response.body, 'JSON');
            });
        });

        promiseIt('should add new imposter to list of all imposters', function () {
            imposter.port = 3535;
            request.body = { protocol: 'http' };

            return controller.post(request, response).then(function () {
                assert.deepEqual(imposters, { 3535: imposter });
            });
        });

        promiseIt('should return a 400 for a floating point port', function () {
            request.body = { protocol: 'http', port: '123.45' };

            return controller.post(request, response).then(function () {
                assert.strictEqual(response.statusCode, 400);
                assert.deepEqual(response.body, {
                    errors: [{
                        code: 'bad data',
                        message: "invalid value for 'port'"
                    }]
                });
            });
        });

        promiseIt('should return a 400 for a missing protocol', function () {
            request.body = { port: 3535 };

            return controller.post(request, response).then(function () {
                assert.strictEqual(response.statusCode, 400);
                assert.deepEqual(response.body, {
                    errors: [{
                        code: 'bad data',
                        message: "'protocol' is a required field"
                    }]
                });
            });
        });

        promiseIt('should return a 400 for unsupported protocols', function () {
            request.body = { port: 3535, protocol: 'unsupported' };

            return controller.post(request, response).then(function () {
                assert.strictEqual(response.statusCode, 400);
                assert.strictEqual(response.body.errors.length, 1);
                assert.strictEqual(response.body.errors[0].code, 'bad data');
            });
        });

        promiseIt('should aggregate multiple errors', function () {
            request.body = { port: -1, protocol: 'invalid' };

            return controller.post(request, response).then(function () {
                assert.strictEqual(response.body.errors.length, 2, response.body.errors);
            });
        });

        promiseIt('should return a 403 for insufficient access', function () {
            Imposter.create = mock().returns(Q.reject({
                code: 'insufficient access',
                key: 'value'
            }));
            request.body = { port: 3535, protocol: 'http' };

            return controller.post(request, response).then(function () {
                assert.strictEqual(response.statusCode, 403);
                assert.deepEqual(response.body, {
                    errors: [{
                        code: 'insufficient access',
                        key: 'value'
                    }]
                });
            });
        });

        promiseIt('should return a 400 for other protocol creation errors', function () {
            Imposter.create = mock().returns(Q.reject('ERROR'));
            request.body = { port: 3535, protocol: 'http' };

            return controller.post(request, response).then(function () {
                assert.strictEqual(response.statusCode, 400);
                assert.deepEqual(response.body, { errors: ['ERROR'] });
            });
        });

        promiseIt('should not call protocol validation if there are common validation failures', function () {
            Protocol.Validator = { create: mock() };
            request.body = { protocol: 'invalid' };

            return controller.post(request, response).then(function () {
                assert.ok(!Protocol.Validator.create.wasCalled());
            });
        });

        promiseIt('should validate with Protocol if there are no common validation failures', function () {
            Protocol.Validator = {
                create: mock().returns({
                    validate: mock().returns(Q({ isValid: false, errors: 'ERRORS' }))
                })
            };
            request.body = { port: 3535, protocol: 'http' };

            return controller.post(request, response).then(function () {
                assert.strictEqual(response.statusCode, 400);
                assert.deepEqual(response.body, { errors: 'ERRORS' });
            });
        });
    });

    describe('#del', function () {
        function stopMock () {
            return mock().returns(Q(true));
        }

        promiseIt('should delete all imposters', function () {
            var firstImposter = { stop: stopMock(), toJSON: mock().returns('firstJSON') },
                secondImposter = { stop: stopMock(), toJSON: mock().returns('secondJSON')},
                imposters = { 1: firstImposter, 2: secondImposter },
                controller = Controller.create({}, imposters, {}, {});

            return controller.del({ url: '/imposters' }, response).then(function () {
                assert.deepEqual(imposters, {});
            });
        });

        promiseIt('should call stop on all imposters', function () {
            var firstImposter = { stop: stopMock(), toJSON: mock().returns('firstJSON') },
                secondImposter = { stop: stopMock(), toJSON: mock().returns('secondJSON')},
                imposters = { 1: firstImposter, 2: secondImposter },
                controller = Controller.create({}, imposters, {}, {});

            return controller.del({ url: '/imposters' }, response).then(function () {
                assert(firstImposter.stop.wasCalled());
                assert(secondImposter.stop.wasCalled());
            });
        });

        promiseIt('should send replayable JSON for all imposters by default', function () {
            var firstImposter = { stop: stopMock(), toJSON: mock().returns('firstJSON') },
                secondImposter = { stop: stopMock(), toJSON: mock().returns('secondJSON')},
                imposters = { 1: firstImposter, 2: secondImposter },
                controller = Controller.create({}, imposters, {}, {});

            return controller.del({ url: '/imposters' }, response).then(function () {
                assert.deepEqual(response.body, { imposters: ['firstJSON', 'secondJSON'] });
                assert.ok(firstImposter.toJSON.wasCalledWith({ replayable: true, removeProxies: false }), firstImposter.toJSON.message());
                assert.ok(secondImposter.toJSON.wasCalledWith({ replayable: true, removeProxies: false }), secondImposter.toJSON.message());
            });
        });

        promiseIt('should send default JSON for all imposters if replayable is false on querystring', function () {
            var firstImposter = { stop: stopMock(), toJSON: mock().returns('firstJSON') },
                secondImposter = { stop: stopMock(), toJSON: mock().returns('secondJSON')},
                controller = Controller.create({}, { 1: firstImposter, 2: secondImposter });

            return controller.del({ url: '/imposters?replayable=false' }, response).then(function () {
                assert.ok(firstImposter.toJSON.wasCalledWith({ replayable: false, removeProxies: false }), firstImposter.toJSON.message());
                assert.ok(secondImposter.toJSON.wasCalledWith({ replayable: false, removeProxies: false }), secondImposter.toJSON.message());
            });
        });

        promiseIt('should send removeProxies JSON for all imposters if querystring present', function () {
            var firstImposter = { stop: stopMock(), toJSON: mock().returns('firstJSON') },
                secondImposter = { stop: stopMock(), toJSON: mock().returns('secondJSON')},
                controller = Controller.create({}, { 1: firstImposter, 2: secondImposter });

            return controller.del({ url: '/imposters?removeProxies=true' }, response).then(function () {
                assert.ok(firstImposter.toJSON.wasCalledWith({ replayable: true, removeProxies: true }), firstImposter.toJSON.message());
                assert.ok(secondImposter.toJSON.wasCalledWith({ replayable: true, removeProxies: true }), secondImposter.toJSON.message());
            });
        });
    });

    describe('#put', function () {
        var request, logger, Protocol;

        beforeEach(function () {
            request = { body: {}, socket: { remoteAddress: 'host', remotePort: 'port' } };
            logger = { debug: mock(), warn: mock() };
            Protocol = {
                name: 'http',
                Validator: {
                    create: mock().returns({ validate: mock().returns(Q({ isValid: true, errors: [] })) })
                }
            };
        });

        promiseIt('should return an empty array if no imposters provided', function () {
            var controller = Controller.create({ 'http': Protocol }, {}, {}, logger);
            request.body = { imposters: [] };

            return controller.put(request, response).then(function () {
                assert.deepEqual(response.body, { imposters: [] });
            });
        });

        promiseIt('should return imposter list JSON for all imposters', function () {
            var firstImposter = { toJSON: mock().returns({ first: true }) },
                secondImposter = { toJSON: mock().returns({ second: true }) },
                imposters = [firstImposter, secondImposter],
                creates = 0,
                Imposter = {
                    create: function () {
                        var result = imposters[creates];
                        creates += 1;
                        return result;
                    }
                },
                controller = Controller.create({ 'http': Protocol }, {}, Imposter, logger);

            request.body = { imposters: [{ protocol: 'http' }, { protocol: 'http' }]};

            return controller.put(request, response).then(function () {
                assert.deepEqual(response.body, { imposters: [ { first: true }, { second: true }]});
                assert.ok(firstImposter.toJSON.wasCalledWith({ list: true }), firstImposter.toJSON.message());
                assert.ok(secondImposter.toJSON.wasCalledWith({ list: true }), secondImposter.toJSON.message());
            });
        });

        promiseIt('should replace imposters list', function () {
            var oldImposter = { stop: mock() },
                imposters = { 0: oldImposter },
                firstImposter = { toJSON: mock().returns({ first: true }), port: 1 },
                secondImposter = { toJSON: mock().returns({ second: true }), port: 2 },
                impostersToCreate = [firstImposter, secondImposter],
                creates = 0,
                Imposter = {
                    create: function () {
                        var result = impostersToCreate[creates];
                        creates += 1;
                        return result;
                    }
                },
                controller = Controller.create({ 'http': Protocol }, imposters, Imposter, logger);

            request.body = { imposters: [{ protocol: 'http' }, { protocol: 'http' }]};

            return controller.put(request, response).then(function () {
                assert.deepEqual(imposters, { 1: firstImposter, 2: secondImposter });
                assert.ok(firstImposter.toJSON.wasCalledWith({ list: true }), firstImposter.toJSON.message());
                assert.ok(secondImposter.toJSON.wasCalledWith({ list: true }), secondImposter.toJSON.message());
            });
        });

        promiseIt('should return a 400 for any invalid imposter', function () {
            var controller = Controller.create({ 'http': Protocol }, {}, {}, logger);

            request.body = { imposters: [{ protocol: 'http' }, {}]};

            return controller.put(request, response).then(function () {
                assert.strictEqual(response.statusCode, 400);
                assert.deepEqual(response.body, {
                    errors: [{
                        code: 'bad data',
                        message: "'protocol' is a required field"
                    }]
                });
            });
        });

        promiseIt('should return a 403 for insufficient access on any imposter', function () {
            var creates = 0,
                Imposter = {
                    create: function () {
                        creates += 1;
                        if (creates === 2) {
                            return Q.reject({
                                code: 'insufficient access',
                                key: 'value'
                            });
                        }
                        else {
                            return Q({});
                        }
                    }
                },
                controller = Controller.create({ 'http': Protocol }, {}, Imposter, logger);

            request.body = { imposters: [{ protocol: 'http' }, { protocol: 'http' }]};

            return controller.put(request, response).then(function () {
                assert.strictEqual(response.statusCode, 403);
                assert.deepEqual(response.body, {
                    errors: [{
                        code: 'insufficient access',
                        key: 'value'
                    }]
                });
            });
        });
    });
});
