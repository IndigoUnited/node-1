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
