'use strict';

var EventEmitter = require('events').EventEmitter;
var zmq          = require('zmq');
var mdns         = require('mdns');
var mout         = require('mout');
var uuid         = require('node-uuid');
var net          = require('net');
var async        = require('async');

var util         = require('util');

function inspect(obj, depth, multiLine) {
    var res = util.inspect(obj, false, depth || 10, true);

    if (!multiLine) {
        res = res.replace(/(\r\n|\n|\r)/gm, ' ');
    }

    return res.replace(/\s+/g, ' ');
}

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

var Node = function (opt) {
    opt = opt || {};

    // the id of the service that the node will provide
    this._service = opt.service || 'indigo1cluster';

    // cluster which the node belongs to
    this._cluster = opt.cluster || 'default';

    // id of the node
    this._id      = opt.id || uuid.v4();

    // port in which the node will be publishing messages
    this._pubPort = opt.port; // if port is not defined, a free one is used

    // interface in which the node will bind
    this._address = opt.address || '0.0.0.0';

    // status flags
    this._inCluster   = false;
    this._advertising = false;

    // used to store information about the other nodes in the cluster
    this._clusterTopology = {};

    // pub and sub sockets
    this._pub = null;
    this._sub = null;

    // mdns advertiser/browser
    this._ad      = null;
    this._browser = null;

    // information that is used to advertise the service
    this._adInfo  = null;

    this._emitter = new EventEmitter();
};

// ----------------------------- PUBLIC METHODS --------------------------------

Node.prototype.getId = function () {
    return this._id;
};

Node.prototype.getCluster = function () {
    return this._cluster;
};

Node.prototype.getClusterTopology = function () {
    return this._clusterTopology;
};

Node.prototype.inCluster = function () {
    return this._inCluster;
};

Node.prototype.advertising = function () {
    return this._advertising;
};

Node.prototype.join = function (callback) {
    this._pub = zmq.socket('pub');
    this._sub = zmq.socket('sub');

    // listen to messages on sub
    this._sub.on('message', this._handleMessage.bind(this));

    async.waterfall([


        // find pub port, if none is defined
        function (next) {
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
            this._pub.bind(this._getBind(this._address, this._pubPort), next);
        }.bind(this),

        // start discovery, so that cluster can find other members of the
        // cluster
        function (next) {
            this._startDiscovery(next);
        }.bind(this)


    ], function (err) {
        if (err) {
            return this._error(err, callback);
        }

        // successfuly joined
        this._inCluster = true;

        // callback + emit join
        this._emitter.emit('join', this._cluster);
        if (typeof(callback) === 'function') process.nextTick(function () { callback(null, this._cluster); }.bind(this));

    }.bind(this));


    return this;
};

Node.prototype.leave = function (callback) {
    var that = this;

    async.series([
        function (next) {
            that._stopDiscovery(next);
        },
        function (next) {
            if (that._advertising) {
                that.stopAdvertise(next);
            } else {
                next();
            }
        },
        function (next) {
            that._sub.removeAllListeners();
            that._sub.close();
            that._pub.close();

            that._sub = null;
            that._pub = null;

            that._inCluster = false;

            next();
        }
    ], function (err) {
        if (err) {
            return that._error(err, callback);
        }

        // callback + emit
        that._emitter.emit('leave', that._cluster);
        if (typeof(callback) === 'function') process.nextTick(function () { callback(null, that._cluster); }.bind(that));
    });

    return that;
};

Node.prototype.startAdvertise = function (details, callback) {
    // fix params in case user does not provide details
    if (typeof(details) === 'function') {
        callback = details;
        details  = null;
    }
    details = details || {};

    // banner will be used to announce the service
    var banner = {
        name: this._id,
        txtRecord: {
            cluster: this._cluster
        }
    };

    // mix the details with the banner, so that they also get advertised
    mout.object.mixIn(banner.txtRecord, details);

    // advertise service
    this._ad = mdns.createAdvertisement(mdns.tcp(this._service), this._pubPort, banner, function (err) {
        if (err) {
            return this._error(err, callback);
        }

        this._advertising = true;

        // callback + emit result
        this._adInfo = {
            service: this._service,
            port:    this._pubPort,
            banner:  banner
        };
        this._emitter.emit('advertise_start', this._adInfo);
        if (typeof(callback) === 'function') process.nextTick(function () { callback(null, this._adInfo); }.bind(this));

    }.bind(this));

    this._ad.start();

    return this;
};

Node.prototype.stopAdvertise = function (callback) {
    this._ad.stop();

    this._ad          = null;
    this._advertising = false;

    this._emitter.emit('advertise_stop', this._adInfo);
    if (typeof(callback) === 'function') process.nextTick(function () { callback(null, this._adInfo); }.bind(this));

    return this;
};

Node.prototype.subscribe = function (channel, callback) {
    if (!this._inCluster) {
        return this._error(new Error('Can\'t subscribe while not in cluster'), callback);
    }

    this._assertChanValid(channel, callback);

    this._sub.subscribe(channel);

    this._emitter.emit('subscribe', channel);
    if (typeof(callback) === 'function') process.nextTick(function () { callback(null, channel); }.bind(this));

    return this;
};

Node.prototype.unsubscribe = function (channel, callback) {
    if (!this._inCluster) {
        return this._error(new Error('Can\'t unsubscribe while not in cluster'), callback);
    }

    this._sub.unsubscribe(channel);

    this._emitter.emit('unsubscribe', channel);
    if (typeof(callback) === 'function') process.nextTick(function () { callback(null, channel); }.bind(this));

    return this;
};

Node.prototype.publish = function (channel, payload) {
    if (!this._inCluster) {
        return this._error(new Error('Can\'t publish while not in cluster'));
    }

    this._assertChanValid(channel);

    this._emitter.emit('publish', channel, payload);

    this._pub.send(channel + ':' + payload);

    return this;
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
    this._browser = mdns.createBrowser(mdns.tcp(this._service), {
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
    if (!mout.lang.isObject(this._clusterTopology[service.name]) &&
        service.txtRecord.cluster === this._cluster) {

        // add node to this node's perception of the cluster
        var info = {
            id:        service.name,
            timestamp: (new Date()).toJSON(),
            address:   service.addresses[0],
            port:      service.port
        };

        info.details = mout.lang.deepClone(service.txtRecord);
        delete info.details.cluster;

        this._clusterTopology[service.name] = info;

        // connect to its pub socket
        this._sub.connect(this._getBind(info.address, info.port));

        this._emitter.emit('node_up', info);
    }
};

Node.prototype._handleNodeDown = function (service) {
    // if node was in this cluster's perception of the cluster, remove it
    if (mout.lang.isObject(this._clusterTopology[service.name])) {
        var info = mout.lang.deepClone(this._clusterTopology[service.name]);
        delete this._clusterTopology[service.name];

        this._emitter.emit('node_down', info);
    }
};

Node.prototype._handleMessage = function (data) {
    data        = data.toString();
    var sepPos  = data.indexOf(':');
    var chan    = data.substr(0, sepPos);
    var payload = data.substr(sepPos + 1);

    this._emitter.emit('message', chan, payload);
};

Node.prototype._getBind = function (addr, port) {
    return 'tcp://' + addr + ':' + port;
};

Node.prototype._assertChanValid = function (channel, callback) {
    if (channel.indexOf(':') > -1) {
        this._error(new Error('Can\'t use commas in channel names'), callback);
    }
};

Node.prototype._error = function (err, callback) {
    // note that the error event is only thrown if a callback was not provided
    if (typeof(callback) === 'function') {
        return callback(err);
    }
    
    this._emitter.emit('error', err);
};



// -----------------------------------------------------------------------------

module.exports = Node;
