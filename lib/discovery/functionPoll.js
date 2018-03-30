'use strict';

const Duplex = require('stream').Duplex;
const _ = require('lodash');

class FunctionPoll extends Duplex {
    constructor(fn, interval, mode = 'full') {
        super();

		this._pollFn = fn;
		this._delay  = interval;
		this._mode   = mode; // 'full' means that the polling function will
							 // return the full topology, while 'diff' will
							 // return only changes

		this._topology = {};
	}

	start() {
		this._timer = setInterval(this._pollFn, this._delay);
	}

	stop() {
		clearInterval(this._timer);
		delete this._timer;
	}

	_write(chunk, encoding, callback) {
      // The underlying source only deals with strings
      if (Buffer.isBuffer(chunk))
        chunk = chunk.toString(encoding);
      this[kSource].writeSomeData(chunk, encoding);
      callback();
    }

    _read(size) {
      this[kSource].fetchSomeData(size, (data, encoding) => {
        this.push(Buffer.from(data, encoding));
      });
    }

	_handlePollFn() {
		this._pollFn()
		.then((current) => {
			switch (this._mode) {
			case 'full':
				break;
			case 'diff':
				break;
			default: throw new Error('Unexpected mode: ' + this._mode);
			}
		});
	}
}

function __diff(previous, current) {

}

module.exports = (fn, interval) => new FunctionPoll(fn, interval);
