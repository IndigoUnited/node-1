# 1 ( *One* )

Clustering module based on [ØMQ](http://www.zeromq.org/).


## Introduction

*1* is a sort of magnet module, gluing together all the nodes that you launch
in a network, and providing a channel based pub/sub.


## Getting started

Take a look at `bin/one.js`.


## Installing

Before you install the module through NPM, using `npm install 1`, make sure you
take care of the instructions below.

The first thing to do, is to install ØMQ. Head to
[http://www.zeromq.org/intro:get-the-software](http://www.zeromq.org/intro:get-the-software)
and follow the instructions for your operating system. Then, use
the instructions below, once again, depending on your operating system.

Also, you might want to tune your OS in order to solve some known
issues with default configurations. To do this, head out to
[http://www.zeromq.org/docs:tuning-zeromq](http://www.zeromq.org/docs:tuning-zeromq),
and follow the instructions.

**Note:** If you are installing on a system that is not covered by these
instructions, and manage to install, please share your instructions, so we can
improve the documentation.


### Linux

Installing on debian-like operating systems, requires that you run the
following:

```
# apt-get install libavahi-compat-libdnssd-dev libc-ares2 libzmq-dev
```


### MacOS X

You will need [XCode command line tools](http://developer.apple.com/library/ios/#documentation/DeveloperTools/Conceptual/WhatsNewXcode/Articles/xcode_4_3.html)
to install *One* on MacOS X, since it depends on
[mdns](https://npmjs.org/package/mdns) and [zmq](https://npmjs.org/package/zmq).
