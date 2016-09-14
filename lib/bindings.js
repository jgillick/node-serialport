'use strict';

var bindings = require('bindings')('serialport.node');
var listLinux = require('./list-linux');

var linux = process.platform !== 'win32' && process.platform !== 'darwin';

var platformOptions = {};
if (process.platform !== 'win32') {
  platformOptions = {
    vmin: 1,
    vtime: 0
  };
}

module.exports = {
  close: bindings.close,
  drain: bindings.drain,
  flush: bindings.flush,
  list: linux ? listLinux : bindings.list,
  open: bindings.open,
  SerialportPoller: bindings.SerialportPoller,
  set: bindings.set,
  get: bindings.get,
  update: bindings.update,
  write: bindings.write,
  platformOptions: platformOptions
};
