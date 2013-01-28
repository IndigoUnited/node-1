var EventEmitter = require('events').EventEmitter;
var zmq          = require('zmq');
var mdns         = require('mdns');
var mout         = require('mout');
var uuid         = require('node-uuid');
var net          = require('net');
var async        = require('async');

function freeport(cb) {
    var server = net.createServer();
    var port;

    server.on('listening', function () {
        port = server.address().port;
        server.close();
    });

    server.on('close', function () {
        cb(null, port);
    });

    server.listen(0);
}

// ------------------------------ CONSTRUCTOR ----------------------------------

var Node = function(opt) {
    opt = opt || {};

    // cluster which the node belongs to
    this._cluster = opt.cluster || 'default';

    // id of the node
    this._id      = opt.id || uuid.v4();

    // port in which the node will be publishing messages
    this._pubPort = opt.pubPort; // if port is not defined, a free one is used

    // interface in which the node will bind
    this._addr = opt.addr || '0.0.0.0';

    // status flags
    this._inCluster   = false;
    this._advertising = false;
    this._discovering = false;

    // used to store information about the other nodes in the cluster
    this._cluster = {};

    // pub and sub sockets
    this._pub = null;
    this._sub = null;

    // mdns advertiser/browser
    this._ad      = null;
    this._browser = null;

    this._emitter = new EventEmitter();
};

// ----------------------------- PUBLIC METHODS --------------------------------

Node.prototype.join = function (callback) {
    this._pub = zmq.socket('pub');
    this._sub = zmq.socket('sub');

    // prepare sub
    this._sub.on('message', this._handleMessage);

    async.waterfall([


        // find pub port, if none is defined
        function (next) {
console.log(1);
            // if port is not defined, find one
            if (!this._pubPort) {
                freeport(function (err, port) {
                    if (err) {
                        return next(err);
                    }

                    this._pubPort = port;

                    next();
                }.bind(this));
            } else {
                next();
            }
        }.bind(this),


        // bind pub port
        function (next) {
console.log(2);
            this._pub.bind(this._getBind(this._addr, this._pubPort), next);
        }.bind(this),


        function (next) {
console.log(3);
            // CONTINUE HERE. NEED TO START DISCOVERY AND SUBSCRIBE TO OTHER NODES
            // IN ORDER TO HAVE JOINED THE CLUSTER. DO NOT START ADVERTISEMENT,
            // SINCE THIS WILL ALLOW ME TO CREATE SPECIAL NODES THAT DO NOT 
            // PUB MESSAGES, BUT CAN CONTROL WHAT'S GOING ON IN THE CLUSTER, LIKE
            // CALCULATING MESSAGES PER SECOND
            this._startDiscovery(next);
        }.bind(this)


    ], function (err, result) {
        if (err) {
            return callback(err);
        }

        // successfuly joined
        this._inCluster = true;

        callback();
    });


    return this;
};

Node.prototype.leave = function (callback) {
    this._sub.close();
    this._pub.close();

    this._sub = null;
    this._pub = null;

    this._inCluster = false;

    callback();

    return this;
};

Node.prototype.startAdvertise = function (callback) {
    this._ad = mdns.createAdvertisement(mdns.tcp('indigo-one'), this._pubPort, {
        name: this._id,
        txtRecord: {
            cluster: this._clusterId
        }
    }, function (err) {
        if (err) {
            return callback(err);
        }

        this._emitter.emit('advertise_start');

        callback();
    }.bind(this));

    this._ad.start();

    return this;
};

Node.prototype.stopAdvertise = function (callback) {
    this._ad.stop();

    this._ad = null;

    this._emitter.emit('advertise_stop');

    callback();

    return this;
};

Node.prototype.subscribe = function (channel, callback) {
    if (!this._inCluster) {
        callback(new Error('Can\'t subscribe while not in cluster'));
    }

    this._sub.subscribe(channel);

    this._emitter.emit('subscribe', channel);

    callback();

    return this;
};

Node.prototype.unsubscribe = function (channel, callback) {
    if (!this._inCluster) {
        callback(new Error('Can\'t unsubscribe while not in cluster'));
    }

    this._sub.unsubscribe(channel);

    this._emitter.emit('unsubscribe', channel);

    callback();

    return this;
};

Node.prototype.publish = function (channel, payload) {
    if (!this._inCluster) {
        throw new Error('Can\'t publish while not in cluster');
    }

    this._pub.send(channel + ':' + payload)
};

Node.prototype.getCluster = function () {
    return this._cluster;
};

Node.prototype.addListener = function () {
    return this._emitter.addListener.apply(this._emitter, arguments);
};

Node.prototype.on = function () {
    return this._emitter.on.apply(this._emitter, arguments);
};

Node.prototype.once = function () {
    return this._emitter.once.apply(this._emitter, arguments);
};

Node.prototype.removeListener = function () {
    return this._emitter.removeListener.apply(this._emitter, arguments);
};

Node.prototype.removeAllListeners = function () {
    return this._emitter.removeAllListeners.apply(this._emitter, arguments);
};

Node.prototype.setMaxListeners = function () {
    return this._emitter.setMaxListeners.apply(this._emitter, arguments);
};

Node.prototype.listeners = function () {
    return this._emitter.listeners.apply(this._emitter, arguments);
};

Node.prototype.emit = function () {
    return this._emitter.emit.apply(this._emitter, arguments);
};

// ----------------------------- PROTECTED METHODS -----------------------------

Node.prototype._startDiscovery = function (callback) {
    this._browser = mdns.createBrowser(mdns.tcp('indigo-one'), {
        resolverSequence: [
            mdns.rst.DNSServiceResolve(),
            mdns.rst.getaddrinfo({
                families: [4]
            }),
            mdns.rst.makeAddressesUnique()
        ]
    });

    this._browser.on('serviceUp', this._handleNodeUp.bind(this));
    this._browser.on('serviceDown', this._handleNodeDown.bind(this));

    this._browser.start();

    callback();

    return this;
};

Node.prototype._stopDiscovery = function (callback) {
    this._browser.stop();

    this._browser.removeListener('serviceUp', this._handleNodeUp);
    this._browser.removeListener('serviceDown', this._handleNodeDown);

    this._browser = null;

    callback();

    return this;
};

Node.prototype._handleNodeUp = function (service) {
    // if node already in cluster or belongs to other cluster, ignore
    if (!mout.lang.isObject(this._cluster[service.name])
        && service.txtRecord.cluster === this._cluster) {
        // add node to this node's perception of the cluster
        var info = {
            id:        service.name,
            timestamp: (new Date()).toJSON(),
            address:   service.addresses[0],
            port:      service.port,
        };
        this._cluster[service.name] = info;

        // connect to its pub socket
        this._sub.connect(this._getBind(info.address, info.port));

        this._emitter.emit('node_up', info);
    }
};

Node.prototype._handleNodeDown = function (service) {
    // if node was in this cluster's perception of the cluster, remove it
    if (mout.lang.isObject(this._cluster[service.name])) {
        var info = mout.lang.deepClone(this._cluster[service.name]);
        delete this._cluster[service.name];

        this._emitter.emit('node_down', info);
    }
};

Node.prototype._handleMessage = function (data) {
    data        = data.toString();
    var sepPos  = data.indexOf(':');
    var chan    = data.slice(0, sepPos);
    var payload = data.slice(sepPos + 1);

    this._emitter.emit('message', chan, payload);
};

Node.prototype._getBind = function (addr, port) {
    return 'tcp://' + addr + ':' + port;
}



// -----------------------------------------------------------------------------

module.exports = Node;