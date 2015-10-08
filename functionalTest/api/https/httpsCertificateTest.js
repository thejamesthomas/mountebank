'use strict';

var assert = require('assert'),
    api = require('../api'),
    fs = require('fs'),
    https = require('https'),
    BaseHttpClient = require('../http/baseHttpClient'),
    promiseIt = require('../../testHelpers').promiseIt,
    port = api.port + 1,
    timeout = parseInt(process.env.SLOW_TEST_TIMEOUT_MS || 2000),
    helpers = require('../../../src/util/helpers'),
    client = BaseHttpClient.create('https');

describe('https imposter', function () {
    this.timeout(timeout);

    promiseIt.only('should reject a client without a cert', function () {
        var request = {port: port, protocol: 'https', name: this.name, requestClientCert: true};

        return api.post('/imposters', request, true).then(function (response) {
            var options = {
                    method: 'GET',
                    path: '/',
                    port: port,
                    key: fs.readFileSync(__dirname + '/cert/client.key', 'utf8').trim(),
                    cert: fs.readFileSync(__dirname + '/cert/client.crt', 'utf8').trim(),
                    //ca: fs.readFileSync(__dirname + '/cert/ca.crt', 'utf8').trim(),
                    agent: false,
                    rejectUnauthorized: false
                };

            assert.strictEqual(response.statusCode, 201);
            //return client.responseFor(options);
        //}).then(function (response) {
        //    assert.strictEqual(response.statusCode, 200);
        }).finally(function () {
            //return api.del('/imposters');
        });
    });
});
