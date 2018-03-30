'use strict';

const EventEmitter = require('events');
const _ = require('lodash');
const uuid = require('uuid');

const Provider = require('./service/Provider');
const Consumer = require('./service/Consumer');

const oneVersion = require('../package').version;

class One extends EventEmitter {
    constructor() {
        super();

        this.version = oneVersion;

        this._topology  = {}; // current topology of discovered services and respective nodes
        this._providers = {}; // providers that are currently in this process
        this._consumers = {}; // consumers that are currently in this process

        this._plugins = {};

        this._hooks = {
            'provider.create.before':  [], // before provider is created
            'provider.create.factory': [], // after instantiation of the provider, but before it is provided to the user
            'provider.announce':       [], // after user calls the `announce` callback, or implicitly once the user marks node as `ready`
            'provider.create.after':   [], // after provider has been set up, and is `ready` to be consumed. Always after `provider.announce`
            'service.up':              [], // after the first node of a service comes up, both if it's a new service, or a service that had all nodes down. Always before `provider.up`
            'provider.up':             [], // after a provider comes up
            'provider.destroy.before': [], // before a provider starts being destroyed
            'provider.destroy.after':  [], // after a provider has been destroyed
            'provider.down':           [], // after a provider goes down
            'service.down':            [], // after the last node of a service goes down. Always after `provider.down`
            'consumer.get.before':     [], // before a service is *got* (`get`) for consumption
            'consumer.get.after':      [], // after a service is *got* (`get`) for consumption
            'consumer.release.before': [], // before a service consumer is released
            'consumer.release.after':  [], // after a service consumer is released

            // TODO: need to review which hooks are necessary for work, in terms of consumer and provider
            'consumer.work.write.before':       [], // before work is written, on the consumer and to be sent to the provider
            'consumer.work.write.after':        [], // after work is written on the consumer, and to be sent to the provider
            'work.read.before':        [], // before work is read on the provider
            'work.read.after':         [], // after work is read on the provider
        }
    }

    create(config) {
        // adjust config
        if (typeof config === 'string') {
            config = {
                service: config
            };
        }

        _.merge(config, {
            provider: {
                id: uuid()
            }
        });

        // call before hooks
        return this._hook('provider.create.before', config)
        // create provider and call factory hooks
        .then((config) => this._hook('provider.create.factory', new Provider(config)))
        // save provider
        .then((provider) => {
            _.set(this._providers, `${config.service}.${providerId}`, provider);

            return provider;
        });
    }

    get(services) {

    }

    release(services) {

    }

    use(plugin) {
        // load plugin
        plugin = plugin(this);

        let pluginName = plugin.name;

        // check if plugin has already been loaded previsouly and fail if so
        if (this._plugins[pluginName]) {
            throw new Error('Tried to load the same plugin multiple times: ' + pluginName);
        }

        // save plugin for future reference
        this._plugins[pluginName] = plugin;

        // add hook handlers
        _.forEach(plugin.hooks, (handler, eventName) => {
            this._hooks[eventName].push({
                // hint of the plugin of the handler, so that it can be unloaded
                plugin: pluginName,

                handler
            });
        });
    }

    _hook(event, data) {
        // handle hooks pipeline and only then emit event with resulting data
        // TODO: consider doing pattern matching below
        let handlers = this._hooks[event].map((entry) => entry.handler);

        // create pseudo-event that will be provided to the hook handlers
        event.preventDefault  = () => event.defaultPrevented   = true;
        event.stopPropagation = () => event.propagationStopped = true;

        return __runHookHandlers(handlers, 0, [event, data])
        .then((data) => {
            // if default behavior was prevented
            if (event.defaultPrevented) {
                return {
                    event,
                    data,
                };
            }

            // if propagation was stopped
            if (event.propagationStopped) {
                return data;
            }

            // emit event with result data of the hook pipeline
            this.emit.call(this, e, data);
        });
    }
}

function __runHookHandlers(hooks, pos, event, data) {
    return Promise.resolve(hooks[pos].call(null, event, data)) // call hook with event and data
    .then((result) => {
        // if default was prevented or event propagation was stopped, return right away
        if (event.defaultPrevented || event.propagationStopped) {
            return result;
        }

        // run next hook handler
        return __runHookHandlers(hooks, pos + 1, [e, result]);
    });
}

module.exports = One;
