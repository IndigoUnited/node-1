var EventEmitter = require('events').EventEmitter;
var zmq          = require('zmq');
var mdns         = require('mdns');
var mout         = require('mout');
var uuid         = require('node-uuid');
var net          = require('net')

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

    this._emitter = new EventEmitter();
};

// ----------------------------- PUBLIC METHODS --------------------------------

Node.prototype.join = function (callback) {
    this._pub = zmq.socket('pub');
    this._sub = zmq.socket('sub');

    // prepare sub
    this._sub.on('message', this._handleMessage);

    // bind function for the pub socket
    var bindPub = function () {
        this._pub.bind(this._getBind(this._addr, this._pubPort), function (err) {
            if (err) {
                return callback(err);
            }

            // successfuly joined
            this._inCluster = true;
            callback();
        }.bind(this));
    }.bind(this);

    // if pub port is defined, use it. Else, find a free one
    if (this._pubPort) {
        bindPub();
    }
    else {
        freeport(function (err, port) {
            if (err) {
                return callback(err);
            }

            this._pubPort = port;

            bindPub();
        }.bind(this));
    }

    return this;
};

Node.prototype.leave = function () {
    this._sub.close();
    this._pub.close();

    delete this._sub;
    delete this._pub;

    this._inCluster = false;

    return this;
};

Node.prototype.startAdvertise = function (callback) {

};

Node.prototype.stopAdvertise = function (callback) {

};

Node.prototype.startDiscovery = function (callback) {

};

Node.prototype.stopDiscovery = function (callback) {

};

Node.prototype.subscribe = function (channel) {
    if (!this._inCluster) {
        throw new Error('Can\'t subscribe while not in cluster');
    }

    this._sub.subscribe(channel);

    this._emitter.emit('subscribe', channel);

    return this;
};

Node.prototype.unsubscribe = function (channel) {
    if (!this._inCluster) {
        throw new Error('Can\'t unsubscribe while not in cluster');
    }

    this._sub.unsubscribe(channel);

    this._emitter.emit('unsubscribe', channel);

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

Node.prototype._handleNodeUp = function (service) {

};

Node.prototype._handleNodeDown = function (service) {

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