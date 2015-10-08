'use strict';

var fs = require('fs'),
    https = require('https'),
    helpers = require('../../util/helpers'),
    baseHttpServer = require('../http/baseHttpServer');

function initialize (allowInjection, recordRequests, keyfile, certfile) {
    var cert = {
            key: fs.readFileSync(keyfile || __dirname + '/cert/server.key'),
            cert: fs.readFileSync(certfile || __dirname + '/cert/server.crt'),
            ca: fs.readFileSync(certfile || __dirname + '/cert/ca.crt'),
            requestCert: true,
            rejectUnauthorized: false
        },
        createServer = function (options) {
            var imposterCert = helpers.clone(cert);
            if (options.requestClientCert) {
                imposterCert.requestCert = true;
            }
            return https.createServer(imposterCert);
        };
    return baseHttpServer.setup('https', createServer).initialize(allowInjection, recordRequests);
}

module.exports = {
    initialize: initialize
};
