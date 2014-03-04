# 1 ( *One* )

Distributed pub/sub based in [ØMQ](http://www.zeromq.org/).

*1* (pronounced One) is a sort of magnet module, gluing together all the nodes that you launch in a network, and providing a simple pub/sub. It allows you to separate several services in the same network by means of 


## Installation

Before you install the module through NPM, using `npm install 1`, make sure you
take care of the instructions below.

The first thing to do, is to install ØMQ. Head to
[http://www.zeromq.org/intro:get-the-software](http://www.zeromq.org/intro:get-the-software)
and follow the instructions for your operating system. Then, use
the instructions below, once again, depending on your operating system.

Also, you might want to tune your OS in order to solve some known
issues with default configurations. To do this, head out to
[http://www.zeromq.org/docs:tuning-zeromq](http://www.zeromq.org/docs:tuning-zeromq),
and follow the instructions.

**Note:** If you are installing on a system that is not covered by these
instructions, and manage to install, please share your instructions, so we can
improve the documentation.


### Linux

Installing on debian-like operating systems, requires that you run the
following:

```
# apt-get install libavahi-compat-libdnssd-dev libc-ares2 libzmq-dev
```


### MacOS X

You will need [XCode command line tools](http://developer.apple.com/library/ios/#documentation/DeveloperTools/Conceptual/WhatsNewXcode/Articles/xcode_4_3.html)
to install *One* on MacOS X, since it depends on
[mdns](https://npmjs.org/package/mdns) and [zmq](https://npmjs.org/package/zmq).


## Getting started

```js
var One = require('1');

var one = new One();

// Let's do something when we receive messages.
one.on('message', function (chan, msg) {
    console.info(chan + '>', msg);
});

// Join the cluster.
one.join(function (err, cluster) {
    err && throw new Error('Unable to join cluster: ' + err);

    // Advertise the service.
    one.advertise(function (err, adInfo) {
        err && throw new Error('Unable to advertise service: ' + err);

        // Subscribe a channel
        one.subscribe('some_channel', function (err, chan) {
            err && throw new Error('Unable to subscribe channel: ' + err);

            // Let's send a message to the channel periodically
            setTimeout(function () {
                one.publish('some_channel', 'You will be notified of this message');

                one.publish('some_channel_you_did_not_subscribe', 'You will not get this message');
            }, 500);
        });
    });
});
```

Here's a more elaborate way of instantiating One, with a few extra options:

```js
// You can pass a few options when instantiating One.
// Note that these are all optional, and you can instantiate without any option.
// The example below shows all the default options.
var one = new One({
    // Id of the service you will be providing.
    service: 'unnamedService',

    // Cluster which this node belongs to.
    cluster: 'defaultCluster',

    // Id of this node. If null, a random id is generated.
    id:      null,

    // Port used for publishing messages. If null, a free random port is used.
    port:    null,

    // Interface in which the node will bind.
    address: '0.0.0.0'
});
```

## Reference

### Introduction

This module can be used to easily create auto discoverable services that communicate through means of a distributed pub/sub. Unlike solutions based on Redis or some message queueing software, this module is based on 0MQ, enabling you to create a pub/sub without a single point of failure or bottleneck. 

### Advertising service

Upon instantiation of *One*, you can specify the `service` which you are providing. This acts as an immediate identifier in case you create multiple service types that you don't want talking to each other. Only after you start advertising other nodes in the cluster will realise you have joined and listen to you. Until that moment, you are a silent node, which is only capable of listening.

Usage:

```js
var one = new One({
    service: 'myStorageService'
});

// ...

// Advertising service
one.advertise(function (err, adInfo) {
    !err && console.log('Advertising', adInfo);
});

// ...

// Stopping advertisement
one.stopAdvertise(function (err, adInfo) {
    !err && console.log('Stopped advertising', adInfo);
});

```

### Clustering

Unlike `service`, clustering allows you to partition multiple nodes of the same service in the same network. Basically, only nodes belonging to the same `cluster` will talk to each other.

Usage:

```js
var one = new One({
    service: 'myStorageService',
    cluster: 'cluster1'
});

// Joining cluster
one.join(function (err, cluster) {
    !err && console.log('Joined', cluster);
});

// ...

// Leaving cluster
one.leave(function (err, cluster) {
    !err && console.log('Left', cluster);
});
```

### Events

Here's a complete list of the available events that you can listen to:

```js
one.on('join', function (cluster) {
    console.log('joined cluster:', cluster);
});

one.on('leave', function (cluster) {
    console.log('left cluster:', cluster);
});

one.on('advertise_start', function (adInfo) {
    console.log('started advertising:', adInfo);
});

one.on('advertise_stop', function (adInfo) {
    console.log('stopped advertising:', adInfo);
});

one.on('subscribe', function (channel) {
    console.log('subscribed:', channel);
});

one.on('unsubscribe', function (channel) {
    console.log('unsubscribed:', channel);
});

one.on('node_up', function (node) {
    console.log('node up:', node);
});

one.on('node_down', function (node) {
    console.log('node down:', node);
});

one.on('message', function (chan, payload) {
    console.log(chan + '>', payload);
});

// Note that the error event is only emitted if you do not specify a callback to
// a method that throws an error.
one.on('error', function (err) {
    console.error('ERROR: ', err);
});
```


## License

Released under the [MIT License](http://www.opensource.org/licenses/mit-license.php).
