'use strict';

module.exports = (one) => ({
	// will identify the plugin uniquely
	name: 'example',

	// Maybe the load/unload functions below are not necessary, trying to not use them
	//
	// // will be called when loading the plugin, and can return both a
	// // boolean or a Promise that will resolve to a boolean. `true` signals
	// // that the plugin is loaded and ready and `false` signals that something
	// // went wrong and will trigger an `Error`
	// load: () => true,
	//
	//
	// // will be called when unloading the plugin, and can return both a boolean
	// // or a Promise that will resolve to a boolean. `true` signals
	// // that the plugin is unloaded `false` signals that something went wrong and
	// // will trigger an `Error`
	// unload: () => true,

	// hooks that the plugin will subscribe to
	hooks: {
		'provider.announce':       (event, node) => node, // hook handler can return a value or a Promise
		'provider.create.after':   (event, node) => node,
		'provider.destroy.before': (event, node) => node,
	});
};
