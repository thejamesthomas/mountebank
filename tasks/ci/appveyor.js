'use strict';

var Q = require('q'),
    https = require('https'),
    apiToken = process.env.APPVEYOR_API_TOKEN;

function responseFor (options) {
    if (!apiToken) {
        throw new Error('APPVEYOR_API_TOKEN environment variable must be set');
    }

    var deferred = Q.defer();

    options.hostname = 'ci.appveyor.com';
    options.headers = {
        Authorization: 'Bearer ' + apiToken
    };

    var request = https.request(options, function (response) {
        var packets = [];

        response.on('data', function (data) {
            packets.push(data);
        });

        response.on('end', function () {
            var contentType = response.headers['content-type'] || '';

            response.body = Buffer.concat(packets).toString('utf8');
            if (contentType.indexOf('application/json') === 0) {
                response.body = JSON.parse(response.body);
            }
            deferred.resolve(response);
        });
    });

    request.on('error', deferred.reject);

    // Appveyor APIs appear to be deeply sensitive in ways that are deeply hard
    // to comprehend to both the capitalization of some headers (e.g. Authorization)
    // and maybe the ordering of some headers.  This block below fails if put in
    // the options object passed into https.request above.
    if (options.body) {
        options.body = JSON.stringify(options.body);
        request.setHeader('Content-Type', 'application/json');
        request.setHeader('Content-Length', options.body.length);
    }

    if (options.body) {
        request.write(options.body);
    }
    request.end();
    return deferred.promise;
}

function triggerBuild (commitId, version) {
    // From what I can tell, POST /api/builds accepts a full SHA for the commitId IF
    // no environmentVariables are passed, but only an 8 digit SHA with environmentVariables
    return responseFor({
        method: 'POST',
        path: '/api/builds',
        body: {
            accountName: 'bbyars',
            projectSlug: 'mountebank',
            branch: 'master',
            commitId: commitId.substring(0, 8),
            environmentVariables: {
                MB_VERSION: version
            }
        }
    }).then(function (response) {
        if (response.statusCode !== 200) {
            console.error('Status code of POST /api/builds: ' + response.statusCode);
            throw response.body;
        }

        return response.body;
    });
}

function getBuildStatus (buildNumber) {
    return responseFor({
        method: 'GET',
        path: '/api/projects/bbyars/mountebank/build/' + buildNumber
    }).then(function (response) {
        if (response.statusCode !== 200) {
            console.error('Status code of GET /api/projects/mountebank/build/' + buildNumber + ': ' + response.statusCode);
            throw response.body;
        }

        return response.body.build.status;
    });
}

module.exports = {
    triggerBuild: triggerBuild,
    getBuildStatus: getBuildStatus
};
