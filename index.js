'use strict';

var EventEmitter = require('events').EventEmitter;
var zmq          = require('zmq');
var mdns         = require('mdns2');
var mout         = require('mout');
var uuid         = require('node-uuid');
var freeport     = require('./lib/freeport');
var async        = require('async');
var inherits     = require('util').inherits;



// ------------------------------ CONSTRUCTOR ----------------------------------

var One = function (opt) {
    EventEmitter.call(this);

    opt = opt || {};

    // the id of the service that the node will provide
    this._service = opt.service || 'unnamedService';

    // cluster which the node belongs to
    this._cluster = opt.cluster || 'defaultCluster';

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
};

inherits(One, EventEmitter);

// ----------------------------- PUBLIC METHODS --------------------------------

One.prototype.getId = function () {
    return this._id;
};

One.prototype.getCluster = function () {
    return this._cluster;
};

One.prototype.getClusterTopology = function () {
    return this._clusterTopology;
};

One.prototype.inCluster = function () {
    return this._inCluster;
};

One.prototype.advertising = function () {
    return this._advertising;
};

One.prototype.join = function (callback) {
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
        this.emit('join', this._cluster);
        callback && process.nextTick(callback.bind(null, null, this._cluster));

    }.bind(this));


    return this;
};

One.prototype.leave = function (callback) {
    var that = this;

    async.waterfal([
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

        that._clusterTopology = {};

        // callback + emit
        that._emitter.emit('leave', that._cluster);
        callback && process.nextTick(callback.bind(null, null, that._cluster));
    });

    return that;
};

One.prototype.advertise = function (details, callback) {
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
        this.emit('advertise_start', this._adInfo);
        callback && process.nextTick(callback.bind(null, null, this._adInfo));

    }.bind(this));

    this._ad.start();

    return this;
};

One.prototype.stopAdvertise = function (callback) {
    this._ad.stop();

    this._ad          = null;
    this._advertising = false;

    this.emit('advertise_stop', this._adInfo);
    callback && process.nextTick(callback.bind(null, null, this._adInfo));

    return this;
};

One.prototype.subscribe = function (channel, callback) {
    if (!this._inCluster) {
        return this._error(new Error('Can\'t subscribe while not in cluster'), callback);
    }

    this._assertChanValid(channel, callback);

    this._sub.subscribe(channel + ':'); // ":" added for separating chan from msg

    this.emit('subscribe', channel);
    callback && process.nextTick(callback.bind(null, null, channel));

    return this;
};

One.prototype.unsubscribe = function (channel, callback) {
    if (!this._inCluster) {
        return this._error(new Error('Can\'t unsubscribe while not in cluster'), callback);
    }

    this._sub.unsubscribe(channel + ':'); // ":" added for separating chan from msg

    this.emit('unsubscribe', channel);
    callback && process.nextTick(callback.bind(null, null, channel));

    return this;
};

One.prototype.publish = function (channel, payload) {
    if (!this._inCluster) {
        return this._error(new Error('Can\'t publish while not in cluster'));
    }

    this._assertChanValid(channel);

    this.emit('publish', channel, payload);

    this._pub.send(channel + ':' + payload);

    return this;
};

// ----------------------------- PROTECTED METHODS -----------------------------

One.prototype._startDiscovery = function (callback) {
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

One.prototype._stopDiscovery = function (callback) {
    this._browser.stop();

    this._browser.removeListener('serviceUp', this._handleNodeUp);
    this._browser.removeListener('serviceDown', this._handleNodeDown);

    this._browser = null;

    callback();

    return this;
};

One.prototype._handleNodeUp = function (banner) {
    // if node already in cluster or belongs to other cluster, ignore
    if (!mout.lang.isObject(this._clusterTopology[banner.name]) &&
        banner.txtRecord.cluster === this._cluster) {

        // add node to this node's perception of the cluster
        var info = {
            id:        banner.name,
            timestamp: (new Date()).toJSON(),
            address:   banner.addresses[0],
            port:      banner.port
        };

        info.details = mout.lang.deepClone(banner.txtRecord);
        delete info.details.cluster;

        this._clusterTopology[banner.name] = info;

        // connect to its pub socket
        this._sub.connect(this._getBind(info.address, info.port));

        this.emit('node_up', info);
    }
};

One.prototype._handleNodeDown = function (banner) {
    // if node was in this cluster's perception of the cluster, remove it
    if (mout.lang.isObject(this._clusterTopology[banner.name])) {
        var info = mout.lang.deepClone(this._clusterTopology[banner.name]);
        delete this._clusterTopology[banner.name];

        this.emit('node_down', info);
    }
};

One.prototype._handleMessage = function (data) {
    data        = data.toString();
    var sepPos  = data.indexOf(':'),
        chan    = data.substr(0, sepPos),
        payload = data.substr(sepPos + 1)
    ;

    this.emit('message', chan, payload);
};

One.prototype._getBind = function (addr, port) {
    return 'tcp://' + addr + ':' + port;
};

One.prototype._assertChanValid = function (channel, callback) {
    if (channel.indexOf(':') > -1) {
        this._error(new Error('Can\'t use commas in channel names'), callback);
    }
};

One.prototype._error = function (err, callback) {
    // note that the error event is only thrown if a callback was not provided
    if (typeof(callback) === 'function') {
        return callback(err);
    }

    this.emit('error', err);
};



// -----------------------------------------------------------------------------

module.exports = One;
