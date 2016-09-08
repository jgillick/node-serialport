'use strict';

var inherits = require('inherits');
var processNextTick = require('process-nextick-args');

function MissingPortError(message) {
  this.message = message || 'Port does not exist - please call hardware.createPort(path) first';
  this.name = 'MissingPortError';
  Error.captureStackTrace(this, MissingPortError);
}
inherits(MissingPortError, Error);

var ports = {};

function MockBindings(opt) {
  if (typeof opt.disconnect !== 'function') {
    throw new TypeError('options.disconnect is not a function');
  }
  this.disconnectedCallback = opt.disconnect;
  this.isOpen = false;
};

MockBindings.reset = function() {
  ports = {};
};

MockBindings.createPort = function(path, options) {
  var echo = (options || {}).echo;
  ports[path] = {
    data: new Buffer(0),
    lastWrite: null,
    echo: echo,
    info: {
      comName: path,
      manufacturer: 'The J5 Robotics Company',
      serialNumber: undefined,
      pnpId: undefined,
      locationId: undefined,
      vendorId: undefined,
      productId: undefined
    }
  };
};

MockBindings.list = function(cb) {
  var info = Object.keys(ports).map(function(path) {
    return ports[path].info;
  });
  processNextTick(cb, null, info);
};

MockBindings.prototype.emitData = function(data) {
  if (!this.port) {
    return;
  }
  this.port.data = Buffer.concat([this.port.data, data]);
  if (this.pendingRead) {
    processNextTick(this.finishRead.bind(this));
  }
};

MockBindings.prototype.disconnect = function() {
  var err = new Error('disconnected');
  this.disconnectedCallback(err);
};

MockBindings.prototype.open = function(path, opt, cb) {
  var port = this.port = ports[path];
  if (!port) {
    return cb(new MissingPortError(path));
  }

  if (port.openOpt && port.openOpt.lock) {
    return cb(new Error('port is locked cannot open'));
  }
  port.openOpt = opt;
  processNextTick(function() {
    this.isOpen = true;
    processNextTick(function() {
      cb(null);
      if (port.echo) {
        processNextTick(function() {
          this.emitData(new Buffer('READY'));
        }.bind(this));
      }
    }.bind(this));
  }.bind(this));
};

MockBindings.prototype.close = function(cb) {
  var port = this.port;
  if (!port) {
    return processNextTick(cb, new Error('port is already closed'));
  }
  processNextTick(function() {
    delete port.openOpt;

    // reset data on close
    port.data = new Buffer(0);

    delete this.port;
    this.isOpen = false;
    processNextTick(cb, null);
  }.bind(this));
};

MockBindings.prototype.update = function(opt, cb) {
  if (typeof opt !== 'object') {
    throw new TypeError('options is not an object');
  }

  if (!opt.baudRate) {
    throw new Error('Missing baudRate');
  }

  if (!this.port) {
    return processNextTick(cb, new MissingPortError());
  }
  this.port.openOpt.baudRate = opt.baudRate;
  processNextTick(cb, null);
};

MockBindings.prototype.set = function(opt, cb) {
  if (typeof opt !== 'object') {
    throw new TypeError('options is not an object');
  }

  if (!this.port) {
    return processNextTick(cb, new MissingPortError());
  }
  processNextTick(cb, null);
};

MockBindings.prototype.write = function(buffer, cb) {
  if (!Buffer.isBuffer(buffer)) {
    throw new TypeError('buffer is not a Buffer');
  }

  var port = this.port;
  if (!port) {
    return processNextTick(cb, new MissingPortError());
  }

  port.lastWrite = new Buffer(buffer); // copy
  processNextTick(cb, null);

  if (port.echo) {
    processNextTick(this.emitData.bind(this), port.lastWrite);
  }
};

MockBindings.prototype.read = function(cb) {
  var port = this.port;
  if (!port) {
    return processNextTick(cb, new MissingPortError());
  }
  if (this.pendingRead) {
    return processNextTick(cb, new Error('Already reading'));
  }
  var data = port.data;
  port.data = new Buffer(0);
  if (data.length > 0) {
    return processNextTick(cb, null, data);
  }
  this.pendingRead = cb;
};

MockBindings.prototype.finishRead = function() {
  var cb = this.pendingRead;
  delete this.pendingRead;
  processNextTick(this.read.bind(this), cb);
};

MockBindings.prototype.flush = function(cb) {
  if (!this.port) {
    return processNextTick(cb, new MissingPortError());
  }
  processNextTick(cb, null);
};

MockBindings.prototype.drain = function(cb) {
  if (!this.port) {
    return processNextTick(cb, new MissingPortError());
  }
  processNextTick(cb, null);
};

module.exports = MockBindings;
