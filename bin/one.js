var One = require('../index.js');

var one = new One();

one.join(function (err) {
    if (err) {
        console.error('Error joining:', err);
        process.exit(1);
    }

    one.on('message', function (chan, payload) {
        console.log(chan + ':', payload);
    });

    one.subscribe('somechan');

    setInterval(function () {
        one.publish('somechan', 'I\'m on caffeine!!');
    }, 100);

    console.log('joined cluster!');

    setTimeout(function () {
        one.leave();
        console.log('left cluster');
    }, 5000);
});
