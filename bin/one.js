var One = require('../index.js');
var async = require('async');

var one = new One();

var chan = 'somechan';

one.on('join', function (cluster) {
    console.log('joined cluster');
});

one.on('leave', function (cluster) {
    console.log('left cluster');
});

one.on('advertise_start', function (adInfo) {
    console.log('started advertising', adInfo);
});

one.on('advertise_stop', function (adInfo) {
    console.log('stopped advertising', adInfo);
});

one.on('subscribe', function (channel) {
    console.log('subscribed', channel);
});

one.on('unsubscribe', function (channel) {
    console.log('unsubscribed', channel);
});

one.on('node_up', function (node) {
    console.log('node up: ', node);
});

one.on('node_down', function (node) {
    console.log('node down: ', node);
});

one.on('message', function (chan, payload) {
    console.log('msg>', chan + ':', payload);
});

async.waterfall([
    function (next) {
        one.join(next);
    },
    function (next) {
        one.startAdvertise(next); // TODO: try subscribing before any node is advertising, and then advertise, to check if the node gets the messages
    },
    function (next) {
        one.subscribe(chan, next);
    }
], function (err, result) {
    if (err) {
        console.error('Error creating cluster:', err);
        process.exit(1);
    }

    var pubTimer = setInterval(function () {
        one.publish(chan, 'I\'m on caffeine!!');
    }, 100);

    

    setTimeout(function () {
        clearInterval(pubTimer);

        one.leave(function () {

        });
    }, 2000);


});

