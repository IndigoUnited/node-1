'use strict';

var One   = require('./index');

// You can pass a few options when instantiating One.
// Note that these are all optional, and you can instantiate without any option.
// The example below shows all the default options.
var one = new One({
    // Id of the service you will be providing.
    service: 'unnamedService',

    // Cluster which this node belongs to.
    cluster: 'defaultCluster',

    // Id of this node. If null, a random id is generated.
    id:      'some_id',

    // Port used for publishing messages. If null, a free random port is used.
    port:    null,

    // Interface in which the node will bind.
    address: '0.0.0.0'
});

// for the sake of simplicity, this example doesn't check for errors
// and the info that is returned in each callbacks isn't used in any way,
// being only there for informative purposes

function throwError(msg) {
    throw new Error(msg);
}

one.on('message', function (chan, msg) {
    console.info(chan + '>', msg);
});

one.join(function (err, cluster) {
    err && throwError('Unable to join cluster: ' + err);

    console.log('joined cluster', cluster);

    one.advertise(function (err, adInfo) {
        err && throwError('Unable to advertise service: ' + err);

        console.log('advertising service', adInfo);
        console.dir(adInfo);

        // Let's subscribe a channel
        one.subscribe('some_channel', function (err, chan) {
            err && throwError('Unable to subscribe channel: ' + err);

            console.log('subscribed channel', chan);

            // Let's send a message to the channel periodically
            setInterval(function () {
                one.publish('some_channel', 'You will be notified of this message');

                one.publish('some_channel_you_did_not_subscribe', 'You will not get this message');
            }, 500);
        });
    });
});
