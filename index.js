var EventEmitter = require('events').EventEmitter;
var zmq  = require('zmq');
var mdns = require('mdns');
var mout = require('mout');
//var uuid = require('uuid');

function freeport(cb) {
    cb(mout.random.randInt(1001, 10000));
}

var Node = function(opt) {
    opt = opt || {};

    // cluster which the node belongs to
    this._cluster = opt.cluster || 'default';

    // id of the node
//    this._id      = opt.id || uuid.v4();

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

    var bindPub = function () {
        this._pub.bind(this._getBind(this._addr, this._pubPort), function (err) {
            if (err) {
                return callback(err);
            }

            callback();
        })
    }.bind(this);

    if (this._pubPort) {
        bindPort();
    }
    else {
        freeport(function (port) {
            this._pubPort = port;

            bindPort();
        }.bind(this));
    }
};

Node.prototype.leave = function () {
    this._sub.close();
    this._pub.close();
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

};

Node.prototype.unsubscribe = function (channel) {

};

Node.prototype.publish = function (channel, payload) {

};

Node.prototype.getCluster = function () {
    return this._cluster;
};

// ----------------------------- PROTECTED METHODS -----------------------------

Node.prototype._handleNodeUp = function (service) {

};

Node.prototype._handleNodeDown = function (service) {

};

Node.prototype._handleMessage = function (data) {
    this._emitter.emit('message', data);
};

Node.prototype._getBind = function (addr, port) {
    return 'tcp://' + addr + ':' + port;
}



// -----------------------------------------------------------------------------

module.exports = Node;