'use strict';

var toArray       = require('mout/lang/toArray');
var fs            = require('fs');
var flattenObject = require('../util/flattenObject');
var objSet        = require('mout/object/set');
var objGet        = require('mout/object/get');
var deepClone     = require('mout/lang/deepClone');


function MockService(service, opt) {
    this._service = service; // underlying service to be mocked

    // method name indexed, each entry is an array with arguments, respective
    // response time and result.
    this._calls = {};

    opt = opt || {};

    this._shouldMock = opt.shouldMock || _shouldMock;

    this._generateMethods();
}

// -----------------------------------------------------------------------------

MockService.prototype._generateMethods = function () {
    var methods = flattenObject(this._service);

    // go through each property
    for (var k in methods) {
        if (this._shouldMock(k)) {
            // proxy the method
            objSet(this, k, this._proxy.bind(this, this._service, k));
        }
    }
};

MockService.prototype._proxy = function (service, method) {
    // Fetch method, args AND callback
    var args = deepClone(toArray(arguments).slice(2));

    // guarantee that structure is initialized
    this._calls[method] = this._calls[method] || [];

    // wrap the callback
    var originalCb = (typeof args[args.length - 1] === 'function' ? args.pop() : undefined);

    // init call replay data
    var callIndex = this._calls[method].length;
    var start     = _now();
    this._calls[method].push({
        args:     args.slice(), // copying array, because we change it below
        duration: undefined,    // will set after callback
        result:   undefined     // will set after callback
    });

    var wrappedCb = function __wrappedCb() {
        var call      = this._calls[method][callIndex];
        call.duration = _now() - start;
        call.result   = deepClone(toArray(arguments));

        // if there was an original callback, call it
        if (originalCb) {
            originalCb.apply(null, arguments);
        }
    }.bind(this);

    args.push(wrappedCb);
    // console.log('received', arguments, 'calling with', args);
    // call the original method
    return objGet(service, method).apply(service, args);
};

// -----------------------------------------------------------------------------

function wrap(service) {
    return new MockService(service);
}

function generate(service, filename) {
    console.log('Generating mock on "' + filename + '"');

    var fd = fs.openSync(filename, 'w');

    fs.writeSync(fd, '\'use strict\';');
    fs.writeSync(fd, '\n');
    fs.writeSync(fd, '// mock generated on ' + new Date() + '\n');
    fs.writeSync(fd, '\n');
    fs.writeSync(fd, 'var crypto = require(\'crypto\');\n');
    fs.writeSync(fd, '\n');
    fs.writeSync(fd, 'var slowdownFactor = parseFloat(process.env.MESH_SLOWDOWN_FACTOR) || 1;\n');
    fs.writeSync(fd, '\n');
    fs.writeSync(fd, 'function Service() {\n');
    fs.writeSync(fd, '\n');
    fs.writeSync(fd, '}\n');
    fs.writeSync(fd, '\n');

    // init all nested function objects
    var nested = {};
    Object.keys(service._calls).reduce(function (result, method) {
        var lastPos = method.lastIndexOf('.');

        // if it's a nested method
        if (lastPos > -1) {
            // add it to results
            result.push(method.slice(0, lastPos));
        }

        return result;
    }, []).forEach(function (prefix) {
        var properties = prefix.split('.');

        properties.reduce(function (prefix, property) {
            var currentProperty = prefix ? prefix + '.' + property : property;

            // if already created this property, skip
            if (nested[currentProperty]) {
                return;
            }

            nested[currentProperty] = true; // mark as created

            fs.writeSync(fd, 'Service.prototype.' + currentProperty + ' = {};\n');

            return currentProperty;
        }, '');
    });
    fs.writeSync(fd, '\n');

    for (var method in service._calls) {
        var methodCalls = service._calls[method];

        fs.writeSync(fd, 'Service.prototype.' + method + ' = function () {\n');

        fs.writeSync(fd, '    var replies = [\n');

        for (var i in methodCalls) {
            var call = methodCalls[i];


            fs.writeSync(fd, JSON.stringify(call, null, '    ').replace(/^/gm, '        ') + ',\n');
        }

        fs.writeSync(fd, '    ];\n');
        fs.writeSync(fd, '\n');
        fs.writeSync(fd, '    var res = _resolve(arguments, replies);\n');
        fs.writeSync(fd, '\n');
        fs.writeSync(fd, '    return _callback(arguments, res.result, res.duration * slowdownFactor);\n');
        fs.writeSync(fd, '};\n');
        fs.writeSync(fd, '\n');
    }
    fs.writeSync(fd, '// -----------------------------------------------------------------------------\n');
    fs.writeSync(fd, '\n');
    fs.writeSync(fd, 'function _resolve(args, replies) {\n');
    fs.writeSync(fd, '    var argsHash = _argsHash(args);\n');
    fs.writeSync(fd, '    var reply;\n');
    fs.writeSync(fd, '    var candidate;\n');
    fs.writeSync(fd, '    var i;\n');
    fs.writeSync(fd, '\n');
    fs.writeSync(fd, '    // go through each of the replies\n');
    fs.writeSync(fd, '    for (i in replies) {\n');
    fs.writeSync(fd, '        reply = replies[i];\n');
    fs.writeSync(fd, '\n');
    fs.writeSync(fd, '        // if args haven\'t been hashed, add hash\n');
    fs.writeSync(fd, '        if (!reply.argsHash) {\n');
    fs.writeSync(fd, '            reply.argsHash = _argsHash(reply.args);\n');
    fs.writeSync(fd, '        }\n');
    fs.writeSync(fd, '\n');
    fs.writeSync(fd, '        // if it\'s the same hash\n');
    fs.writeSync(fd, '        if (argsHash === reply.argsHash) {\n');
    fs.writeSync(fd, '            // and this reply hasn\'t been used yet, use it\n');
    fs.writeSync(fd, '            if (!reply.returned) {\n');
    fs.writeSync(fd, '                // mark it as returned\n');
    fs.writeSync(fd, '                reply.returned = true;\n');
    fs.writeSync(fd, '\n');
    fs.writeSync(fd, '                return reply;\n');
    fs.writeSync(fd, '            }\n');
    fs.writeSync(fd, '\n');
    fs.writeSync(fd, '            // already returned, so mark it as candidate, in case a new one\n');
    fs.writeSync(fd, '            // is not available\n');
    fs.writeSync(fd, '            candidate = reply;\n');
    fs.writeSync(fd, '        }\n');
    fs.writeSync(fd, '    }\n');
    fs.writeSync(fd, '\n');
    fs.writeSync(fd, '    if (candidate) {\n');
    fs.writeSync(fd, '        return candidate;\n');
    fs.writeSync(fd, '    }\n');
    fs.writeSync(fd, '\n');
    fs.writeSync(fd, '    throw new Error(\'Unable to find suitable mock reply\');\n');
    fs.writeSync(fd, '}\n');
    fs.writeSync(fd, '\n');
    fs.writeSync(fd, 'function _callback(args, result, timeout) {\n');
    fs.writeSync(fd, '    args = Array.prototype.slice.call(args);\n');
    fs.writeSync(fd, '\n');
    fs.writeSync(fd, '    var cb = args[args.length - 1];\n');
    fs.writeSync(fd, '\n');
    fs.writeSync(fd, '    setTimeout(function () {\n');
    fs.writeSync(fd, '        return cb.apply(null, result);\n');
    fs.writeSync(fd, '    }, timeout);\n');
    fs.writeSync(fd, '}\n');
    fs.writeSync(fd, '\n');
    fs.writeSync(fd, 'function _argsHash(args) {\n');
    fs.writeSync(fd, '    args = Array.prototype.slice.call(args);\n');
    fs.writeSync(fd, '\n');
    fs.writeSync(fd, '    // if there is a callback, remove it\n');
    fs.writeSync(fd, '    if (typeof args[args.length - 1] === \'function\') {\n');
    fs.writeSync(fd, '        args.pop();\n');
    fs.writeSync(fd, '    }\n');
    fs.writeSync(fd, '\n');
    fs.writeSync(fd, '    return crypto.createHash(\'md5\').update(JSON.stringify(args)).digest(\'hex\');\n');
    fs.writeSync(fd, '}\n');
    fs.writeSync(fd, '\n');
    fs.writeSync(fd, 'module.exports = new Service();\n');

    fs.closeSync(fd);
}

// -----------------------------------------------------------------------------

function _shouldMock(method) {
    return method[0] !== '_';
}

function _now() {
    return Math.floor((new Date()).getTime());
}

// -----------------------------------------------------------------------------

module.exports = {
    wrap:     wrap,
    generate: generate
};
