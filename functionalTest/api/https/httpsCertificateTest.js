'use strict';

var assert = require('assert'),
    api = require('../api'),
    promiseIt = require('../../testHelpers').promiseIt,
    port = api.port + 1,
    timeout = parseInt(process.env.MB_SLOW_TEST_TIMEOUT || 4000),
    fs = require('fs'),
    path = require('path'),
    client = require('../http/baseHttpClient').create('https'),
    key = fs.readFileSync(path.join(__dirname, '/cert/key.pem'), 'utf8'),
    cert = fs.readFileSync(path.join(__dirname, '/cert/cert.pem'), 'utf8'),
    defaultKey = fs.readFileSync(path.join(__dirname, '/../../../src/models/https/cert/mb-key.pem'), 'utf8'),
    defaultCert = fs.readFileSync(path.join(__dirname, '/../../../src/models/https/cert/mb-cert.pem'), 'utf8');

describe('https imposter', function () {
    this.timeout(timeout);

    promiseIt('should support sending key/cert pair during imposter creation', function () {
        var request = {
            protocol: 'https',
            port: port,
            key: key,
            cert: cert,
            name: this.name
        };

        return api.post('/imposters', request).then(function (response) {
            assert.strictEqual(response.statusCode, 201);
            assert.strictEqual(response.body.key, key);
            assert.strictEqual(response.body.cert, cert);
            return client.get('/', port);
        }).then(function (response) {
            assert.strictEqual(response.statusCode, 200);
        }).finally(function () {
            return api.del('/imposters');
        });
    });

    promiseIt('should default key/cert pair during imposter creation if not provided', function () {
        var request = { protocol: 'https', port: port, name: this.name };

        return api.post('/imposters', request).then(function (response) {
            assert.strictEqual(response.statusCode, 201);
            assert.strictEqual(response.body.key, defaultKey);
            assert.strictEqual(response.body.cert, defaultCert);
            return client.get('/', port);
        }).then(function (response) {
            assert.strictEqual(response.statusCode, 200);
        }).finally(function () {
            return api.del('/imposters');
        });
    });

    promiseIt('should work with mutual auth', function () {
        var request = { protocol: 'https', port: port, mutualAuth: true, name: this.name };

        return api.post('/imposters', request).then(function (response) {
            assert.strictEqual(response.statusCode, 201);
            assert.strictEqual(response.body.mutualAuth, true);
            return client.responseFor({
                method: 'GET',
                path: '/',
                port: port,
                agent: false,
                key: key,
                cert: cert
            });
        }).then(function (response) {
            assert.strictEqual(response.statusCode, 200);
        }).finally(function () {
            return api.del('/imposters');
        });
    });

    promiseIt('should support proxying to origin server requiring mutual auth', function () {
        var originServerPort = port + 1,
            originServerRequest = {
                protocol: 'https',
                port: originServerPort,
                stubs: [{ responses: [{ is: { body: 'origin server' } }] }],
                name: this.name + ' origin',
                mutualAuth: true
            },
            proxy = {
                to: 'https://localhost:' + originServerPort,
                key: key,
                cert: cert
            },
            proxyRequest = {
                protocol: 'https',
                port: port,
                stubs: [{ responses: [{ proxy: proxy }] }],
                name: this.name + ' proxy'
            };

        return api.post('/imposters', originServerRequest).then(function (response) {
            assert.strictEqual(response.statusCode, 201, JSON.stringify(response.body, null, 2));
            return api.post('/imposters', proxyRequest);
        }).then(function (response) {
            assert.strictEqual(response.statusCode, 201, JSON.stringify(response.body, null, 2));
            return client.get('/', port);
        }).then(function (response) {
            assert.strictEqual(response.body, 'origin server');
        }).finally(function () {
            return api.del('/imposters');
        });
    });
});
