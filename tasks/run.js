'use strict';

var spawn = require('child_process').spawn,
    os = require('os'),
    Q = require('q');

function isWindows () {
    return os.platform().indexOf('win') === 0;
}

function run (command, args, options) {
    var deferred = Q.defer(),
        npmFailure = false,
        proc;

    if (isWindows()) {
        // spawn on Windows requires an exe
        args.unshift(command);
        args.unshift('/c');
        command = 'cmd.exe';
    }

    proc = spawn(command, args, options);

    proc.stdout.on('data', function (data) {
        console.log(data.toString('utf8').trim());
    });

    proc.stderr.on('data', function (data) {
        console.error(data.toString('utf8').trim());
        if (data.toString('utf8').indexOf('npm ERR!') >= 0) {
            // Hack; dpl returns 0 exit code on npm publish failure
            npmFailure = true;
        }
    });

    proc.on('close', function (exitCode) {
        if (exitCode === 0 && !npmFailure) {
            deferred.resolve();
        }
        else {
            deferred.reject(npmFailure ? 1 : exitCode);
        }
    });

    return deferred.promise;
}

module.exports = {
    run: run
};
