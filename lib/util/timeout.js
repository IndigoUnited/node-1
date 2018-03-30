'use strict';

function defaultErrHandler(msg, cb) {
    let err  = new Error(msg);
    err.code = 'ETIMEDOUT';

    return cb(err);
}

/**
 * Automatically timeout a callback.
 *
 * @param  {Number}   maxTime        Time in milliseconds
 * @param  {Function} fn             The callback you'd like to see called. If maxTime passes, it will automatically be called with an error.
 * @param  {function/string}         timeoutHandler A string to be used as message of the timeout Error, or a function (cb), which should callback cb with the Error that you want to return
 *
 * @return {function}                A wrapped function that will automatically timeout. Note that this function will ignore calls after it has timed out.
*/
module.exports = function (maxTime, fn, timeoutHandler) {
    let alreadyReturned = false,
        timeout;

    // if no timeout handler, use default
    if (!timeoutHandler) {
        timeoutHandler = defaultErrHandler.bind(null, 'Callback function timed out.');
    }

    // if timeout handler is a string, use it as message
    if (typeof timeoutHandler === 'string') {
        timeoutHandler = defaultErrHandler.bind(null, timeoutHandler);
    }

    // guarantee timeout handler is a function now
    if (typeof timeoutHandler !== 'function') {
        return fn(new Error('The timeout handler must be a function or string'));
    }

    timeout = setTimeout(function () {
        // if called, then a timeout occurred
        alreadyReturned = true;

        // call error handler, which will in its turn call the callback with an error
        return setImmediate(timeoutHandler.bind(null, fn));
    }, maxTime);

    return function () {
        if (alreadyReturned) {
            return;
        }

        // mark callback as called
        alreadyReturned = true;

        clearTimeout(timeout);

        // callback
        fn.apply(null, arguments);
    };
};
