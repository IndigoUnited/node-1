var One   = require('../index.js');
var async = require('async');
var util  = require('util');

function inspect(obj, depth, multiLine) {
    var res = util.inspect(obj, false, depth || 10, true);

    if (!multiLine) {
        res = res.replace(/(\r\n|\n|\r)/gm, ' ');
    }

    return res.replace(/\s+/g, ' ');
}

var one = new One();

console.log('Usage: one channel msg interval leaveTimeout');

var chan         = process.argv[2] || 'somechan';
var msg          = process.argv[3];
var interval     = process.argv[4];
var leaveTimeout = process.argv[5] || 0;

// you can either use events or callbacks to handle the node
one.on('join', function (cluster) {
    console.log('joined cluster:', cluster);
});

one.on('leave', function (cluster) {
    console.log('left cluster:', cluster);
});

one.on('advertise_start', function (adInfo) {
    console.log('started advertising:', inspect(adInfo));
});

one.on('advertise_stop', function (adInfo) {
    console.log('stopped advertising:', inspect(adInfo));
});

one.on('subscribe', function (channel) {
    console.log('subscribed:', channel);
});

one.on('unsubscribe', function (channel) {
    console.log('unsubscribed:', channel);
});

one.on('node_up', function (node) {
    console.log('node up:', inspect(node));
});

one.on('node_down', function (node) {
    console.log('node down:', inspect(node));
});

one.on('message', function (chan, payload) {
    console.log('msg:', chan + ':', payload);
});

// note that the error event is only thrown if you do not specify a callback to
// a method that could potentially throw an error
one.on('error', function (err) {
    console.error('ERROR: ', err);
});

// the example below shows a an approach using callbacks. For the sake of
// reducing the amount of code and logging, there won't be any checks for errors
// and the info that is returned in the callbacks won't be used in any way,
// being only there for informative purposes
async.waterfall([
    function (next) {
        one.join(function (err, cluster) {

            next();
        });
    },
    function (next) {
        one.startAdvertise(function (err, adInfo) {
            next();
        });
    },
    function (next) {
        if (chan) {
            one.subscribe(chan, function (err, chan) {
                next();
            });
        } else {
            next();
        }
    }
], function () {
    var pubTimer;

    if (chan && msg && interval) {

        pubTimer = setInterval(function () {
            one.publish(chan, msg);
        }, interval);
    }

    
    if (leaveTimeout) {
        setTimeout(function () {
            clearInterval(pubTimer);

            one.leave(function () {

            });
        }, leaveTimeout);
    }


});

