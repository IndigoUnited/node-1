'use strict';

let isArray = Array.isArray;

function flattenObject(obj, accumulator, prefix, visited) {
    let tmp;
    if (!accumulator) {
        accumulator = {};
        prefix      = '';
        visited     = [];
    }

    for (let key in obj) {
        // // skip any pseudo-private key
        // if (key[0] === '_') {
        //     continue;
        // }

        if (obj.hasOwnProperty(key)) {
            tmp = obj[key];

            if (typeof tmp === 'function') {
                accumulator[prefix + key] = tmp;
            }

            if ((typeof tmp === 'object' || (typeof tmp === 'function' && Object.keys(tmp).length)) && !isArray(tmp) && visited.indexOf(tmp) < 0) {
                visited.push(tmp);
                flattenObject(tmp, accumulator, prefix + key + '.', visited);
            }
        }
    }

    return accumulator;
}

module.exports = flattenObject;
