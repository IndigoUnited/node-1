- One
    - The core module that manages what's happening.
    - Several hooks available for plugins:
        - Service lifecycle:
            - `node.create.before`: before service node is created.
            - `node.announce`: after user calls the *announce* callback, or implicitly if user calls the *ready* callback before having called the *announce* callback.
            - `node.create.after`: after service node has been set up, and is ready to be consumed. Always after `node.announce`.
            - `service.up`
            - `node.up`
            - `node.destroy.before`:
            - `node.destroy.after`:
            - `node.down`
            - `service.down`
            - `service.get`
            - `service.release`
        - Work pipeline:
            - `work.write.before`
            - `work.write.after`
            - `work.read.before`
            - `work.read.after`

    - Hooks can be used by plugins to prevent default behavior and to modify data within the hook. All hooks are async, and are called by the order that the plugins were added.
- Service
    - Services internally possess a `work` Duplex stream, which handles data in the format `{ plugin: 'rpc', payload: 'some payload here' }`. This applies both to data written into and read from the service, and the `plugin` field specifies which plugin will be responsible for encoding or decoding the data.
- Service discovery (Duplex stream):
    - One version is advertised, which dictates that incompatible versions do not interact.
    - Emits `data` with changes in the topology: `{ type: 'service.up/service.down/node.up/node.down' }`.
    - Services announce which plugins they are using, along with their versions, maybe even the Transports and their versions as well.
    - Can use multiple discovery agents simultaneously:
        - https://github.com/mrhooray/swim-js
        - MDNS.
        - etcd.
        - file watch.
        - Generic function polling: User provided function is polled in order to get configuration (full or diff), and the diff is computed automatically from previous if necessary.
        - Generic stream: User provided stream is listened to in order to get configuration changes (full or diff), and the diff is computed automatically from previous if necessary.
- Plugins
    - `ReqRep`/`RPC`:
        - Hooks: `rpc.req`, `rpc.res`.
        - Errors should propagate back and the stack should be concatenated throughout the services, to simplify debugging. Might require having an config to disable this.
    - `EventEmitter`:
        - Hooks: `eventemitter.data.write`, `eventemitter.data.read`.
    - `Stream`:
        - Need to think about how a service can be a Writable, Readable, Transform, Passthrough or Duplex stream.
    - `Versioning`: Version control for services.
    - `Authentication`: Authenticate access to a service.
    - `Authorisation`: Check authorisation to perform operation.
    - `Namespace`: Separate similar services, useful for environments.
    - Plugins can emit hooks that other plugins will listen to.
    - Can have their own Transport (Duplex streams):
        - Sockets.
        - HTTP.
        - ZeroMQ.
        - Inproc (in process).
        - Transports have versions, and a consumer will only connect to a provider of compatible versions.
        - Transports need an encoder and decoder pipeline (Transform streams):
            - Encoders/decoders can be piped in order to transform data that is written into or read from the service.
            - Encryption.
            - Compression.
            - Serialization:
                - JSONRPC
                - XMLRPC
                - Protobuf (https://github.com/dcodeIO/ProtoBuf.js/)
                - Consider having a `Stream` serialiser, that looks for streams in the data and exposes a structure that allows the stream to be used from another service. Options to transport this stream could be:
                    - HTTP stream
                    - Socket stream
                    - Should allow providing an encode and decode stream, so that user can perform operations on the transport itself like encryption and compression.

## Thoughts

- Try to use as little native modules as possible, so that One can run on any Node.js environment.

- Should provide an "in process" transport as well, to optimize communication.
- "max pending calls" should be configurable and defaulted to reasonable value.
- Allow multi-get of services.
- timeout if get service takes too long.
- Support nested objects in service definition.
- Make callbacks optional. Sometimes not necessary.
- Should support Promises.
- Limit amount of connections on consumer to available providers.
- "service release" method that cleans up the connections.
- Consider using https://github.com/mafintosh/polo instead of mdns2. Also, mdns is now active again. Maybe should replace? (https://github.com/kmpm/node-mdns-js)
- REPL for directly managing cluster and interacting with services. See http://learnboost.github.io/cluster/docs/repl.html for inspiration.
- Create mechanism for easily aggregating services, like RESTful services, which likely need to be proxied and load balanced. Might not be a feature at "One" level, probably something built on top, but still would like to have it.
- Add ability for true "once" event handlers.

## Introduction

```js
const One = require('1');

const one = new One();

one.create('calculator', (err, calculator, serviceReadyCb, announceServiceCb) => {
    if (err) {
        return console.error(err);
    }

    calculator.multiply = function (a, b, callback) {
        callback(null, a * b);
    }

    calculator.double = function (a, callback) {
        // you can use other methods from the service;
        this.multiply(a, 2, callback);
    }

    // by calling serviceReadyCb, announceServiceCb is implicitly called if it
    // hasn't been called yet
    serviceReadyCb();
});

one.get('calculator', (err, calculator) => {
    if (err) {
        return console.error(err);
    }

    calculator.double(4, (err, result) => {
        if (err) {
            return console.error(err);
        }

        console.log(result); // 8
    });
});


// or you can use the Promise based API


one.create('calculator')
.then((res) => {
    let { calculator, announceServiceCb } = res;

    // you can call announceServiceCb once you've added all methods to the
    // service, so that the service starts getting announced for discovery.
    // This can be used to solve circular dependencies.

    calculator.multiply = function (a, b) {
        // you can declare your methods both Promise style or callback style
        // and the consumer can consume in both styles, it's transparent to
        // the consumer
        return new Promise((resolve, reject) => {
            resolve(a * b);
        });
    }

    calculator.double = function (a) {
        // call other methods from the service using Promise style
        return this.multiply(a, 2);
    }

    return calculator;
})
.catch((err) => {
    console.error(err);
});

one.get('calculator')
.then(calculator => calculator.double(4))
.then(result => console.log(result))
.catch(err => console.error(err));
```
