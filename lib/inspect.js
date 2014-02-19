'use strict';

var util = require('util');

module.exports = function (obj, depth, multiLine) {
    var res = util.inspect(obj, false, depth || 10, true);

    if (!multiLine) {
        res = res.replace(/(\r\n|\n|\r)/gm, ' ');
    }

    return res.replace(/\s+/g, ' ');
};
