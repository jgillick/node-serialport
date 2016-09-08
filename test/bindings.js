'use strict';

var assert = require('chai').assert;
var assign = require('object.assign').getPolyfill();

var platform;
switch (process.platform) {
  case 'win32':
    platform = 'win32';
    break;
  case 'darwin':
    platform = 'darwin';
    break;
  default:
    platform = 'unix';
}

var defaultPortOpenOptions = {
  baudRate: 9600,
  dataBits: 8,
  hupcl: true,
  lock: true,
  parity: 'none',
  rtscts: false,
  stopBits: 1,
  xany: false,
  xoff: false,
  xon: false,
  // high watermark?
  // bufferSize: 64 * 1024,
};

var defaultSetFlags = {
  brk: false,
  cts: false,
  dtr: true,
  dts: false,
  rts: true
};

var bindingsToTest = [
  'mock',
  platform
];

// Test our mock binding and the binding for the platform we're running on
bindingsToTest.forEach(function(bindingName) {
  var binding = require('../lib/bindings-' + bindingName);
  var testPort = process.env.TEST_PORT;
  if (bindingName === 'mock') {
    testPort = '/dev/exists';
    binding.createPort(testPort, { echo: true });
  }

  // eslint-disable-next-line no-use-before-define
  testBinding(bindingName, binding, testPort);
});

function testBinding(bindingName, Binding, testPort) {
  describe('bindings-'+ bindingName, function() {
    describe('static method', function() {
      describe('.list', function() {
        it('returns an array', function(done) {
          Binding.list(function(err, data) {
            assert.isNull(err);
            assert.isArray(data);
            done();
          });
        });

        it('has objects with undefined when there is no data', function(done) {
          Binding.list(function(err, data) {
            assert.isNull(err);
            assert.isArray(data);
            if (data.length === 0) {
              console.log('no ports to test');
              return done();
            }
            var obj = data[0];
            Object.keys(obj).forEach(function(key) {
              assert.notEqual(obj[key], '', 'empty values should be undefined');
              assert.isNotNull(obj[key], 'empty values should be undefined');
            });
            done();
          });
        });
      });
    });

    describe('constructor', function() {
      it('creates a binding object', function() {
        var binding = new Binding({
          disconnect: function() {}
        });
        assert.instanceOf(binding, Binding);
      });

      it('throws when missing required options', function(done) {
        try {
          new Binding({});
        } catch(e) {
          assert.instanceOf(e, TypeError);
          done();
        }
      });
    });

    describe('instance method', function() {
      var binding;
      beforeEach(function() {
        binding = new Binding({
          disconnect: function() {}
        });
      });

      describe('.isOpen', function() {
        if (!testPort) {
          it('Cannot be tested. Set the TEST_PORT env var with an available serialport for more testing.');
          return;
        }

        it('is true after open and false after close', function(done) {
          assert.equal(binding.isOpen, false);
          binding.open(testPort, defaultPortOpenOptions, function(err) {
            assert.isNull(err);
            assert.equal(binding.isOpen, true);
            binding.close(function(err) {
              assert.isNull(err);
              assert.equal(binding.isOpen, false);
              done();
            });
          });
        });
      });

      describe('#open', function() {
        it('errors when providing a bad port', function(done) {
          binding.open('COMBAD', defaultPortOpenOptions, function(err) {
            assert.instanceOf(err, Error);
            assert.include(err.message, 'COMBAD');
            assert.equal(binding.isOpen, false);
            done();
          });
        });

        if (!testPort) {
          it('Cannot be tested further. Set the TEST_PORT env var with an available serialport for more testing.');
          return;
        }

        it('keeps open state', function(done) {
          binding.open(testPort, defaultPortOpenOptions, function(err) {
            assert.isNull(err);
            assert.equal(binding.isOpen, true);
            binding.close(done);
          });
        });

        if (platform === 'win32') {
          it('doesn\'t supports a custom baudRates of 25000');
        } else {
          it('supports a custom baudRate of 25000', function(done) {
            var customRates = assign({}, defaultPortOpenOptions, {baudRate: 25000});
            binding.open(testPort, customRates, function(err) {
              assert.isNull(err);
              assert.equal(binding.isOpen, true);
              binding.close(done);
            });
          });
        }

        describe('optional locking', function() {
          // Ensure that if we fail, we still close the port
          afterEach(function(done) {
            binding.close(function() {
              done();
            });
          });

          it('locks the port by default', function(done) {
            var binding2 = new Binding({disconnect: function() {}});

            binding.open(testPort, defaultPortOpenOptions, function(err) {
              assert.isNull(err);
              assert.equal(binding.isOpen, true);

              binding2.open(testPort, defaultPortOpenOptions, function(err) {
                assert.instanceOf(err, Error);
                assert.equal(binding2.isOpen, false);
                binding.close(done);
              });
            });
          });

          if (platform === 'win32') {
            it('Ports currently cannot be unlocked on windows');
          } else {
            it('can unlock the port', function(done) {
              var noLock = assign({}, defaultPortOpenOptions, {lock: false});
              var binding2 = new Binding({disconnect: function() {}});

              binding.open(testPort, noLock, function(err) {
                assert.isNull(err);
                assert.equal(binding.isOpen, true);

                binding2.open(testPort, noLock, function(err) {
                  assert.isNull(err);
                  assert.equal(binding2.isOpen, true);

                  binding.close(function(err) {
                    assert.isNull(err);
                    binding2.close(done);
                  });
                });
              });
            });
          }
        });
      });

      describe('#close', function() {
        it('errors when already closed', function(done) {
          binding.close(function(err) {
            assert.instanceOf(err, Error);
            done();
          });
        });

        if (!testPort) {
          it('Cannot be tested further. Set the TEST_PORT env var with an available serialport for more testing.');
          return;
        }

        it('closes an open file descriptor', function(done) {
          binding.open(testPort, defaultPortOpenOptions, function(err) {
            assert.isNull(err);
            assert.equal(binding.isOpen, true);
            binding.close(function(err) {
              assert.isNull(err);
              done();
            });
          });
        });
      });

      describe('#update', function() {
        it('errors when not open', function(done) {
          var binding = new Binding({disconnect: function() {}});
          binding.update({baudRate: 9600}, function(err) {
            assert.instanceOf(err, Error);
            done();
          });
        });

        if (!testPort) {
          it('Cannot be tested further. Set the TEST_PORT env var with an available serialport for more testing.');
          return;
        }

        beforeEach(function(done) {
          binding.open(testPort, defaultPortOpenOptions, done);
        });

        afterEach(function(done) {
          binding.close(done);
        });

        it('throws errors when updating nothing', function(done) {
          try {
            binding.update({}, function() {});
          } catch (err) {
            assert.instanceOf(err, Error);
            done();
          }
        });

        it('errors when not called with options', function(done) {
          try {
            binding.set(function() {});
          } catch(e) {
            assert.instanceOf(e, Error);
            done();
          }
        });

        it('updates baudRate', function(done) {
          binding.update({baudRate: 57600}, done);
        });

        if (platform === 'win32') {
          it("doesn't yet support custom rates");
          return;
        }

        it('updates baudRate to a custom rate', function(done) {
          binding.update({baudRate: 25000}, done);
        });
      });

      describe('#write', function() {
        it('errors when not open', function(done) {
          var binding = new Binding({disconnect: function() {}});
          binding.write(new Buffer([]), function(err) {
            assert.instanceOf(err, Error);
            done();
          });
        });

        it('throws when not given a buffer', function(done) {
          try {
            binding.write(null, function() {});
          } catch(e) {
            assert.instanceOf(e, TypeError);
            done();
          }
        });

        if (!testPort) {
          it('Cannot be tested as we have no test ports on ' + platform);
          return;
        }

        beforeEach(function(done) {
          binding.open(testPort, defaultPortOpenOptions, done);
        });

        afterEach(function(done) {
          binding.close(done);
        });

        it('calls the write callback once after a small write', function(done) {
          var data = new Buffer('simple write of 24 bytes');
          binding.write(data, function(err) {
            assert.isNull(err);
            done();
          });
        });

        it('calls the write callback once after a 5k write', function(done) {
          this.timeout(20000);
          var data = new Buffer(1024 * 5);
          binding.write(data, function(err) {
            assert.isNull(err);
            done();
          });
        });
      });

      describe('#drain', function() {
        it('errors when not open', function(done) {
          var binding = new Binding({disconnect: function() {}});
          binding.drain(function(err) {
            assert.instanceOf(err, Error);
            done();
          });
        });

        if (!testPort) {
          it('Cannot be tested further. Set the TEST_PORT env var with an available serialport for more testing.');
          return;
        }

        beforeEach(function(done) {
          binding.open(testPort, defaultPortOpenOptions, done);
        });

        afterEach(function(done) {
          binding.close(done);
        });

        it('drains the port', function(done) {
          binding.drain(function(err) {
            assert.isNull(err);
            done();
          });
        });
      });

      describe('#flush', function() {
        it('errors when not open', function(done) {
          var binding = new Binding({disconnect: function() {}});
          binding.flush(function(err) {
            assert.instanceOf(err, Error);
            done();
          });
        });

        if (!testPort) {
          it('Cannot be tested further. Set the TEST_PORT env var with an available serialport for more testing.');
          return;
        }

        beforeEach(function(done) {
          binding.open(testPort, defaultPortOpenOptions, done);
        });

        afterEach(function(done) {
          binding.close(done);
        });

        it('flushes the port', function(done) {
          binding.flush(done);
        });
      });

      describe('#set', function() {
        it('errors when not open', function(done) {
          var binding = new Binding({disconnect: function() {}});
          binding.set(defaultSetFlags, function(err) {
            assert.instanceOf(err, Error);
            done();
          });
        });

        it('throws when not called with options', function(done) {
          try {
            binding.set(function() {});
          } catch(e) {
            assert.instanceOf(e, TypeError);
            done();
          }
        });

        if (!testPort) {
          it('Cannot be tested further. Set the TEST_PORT env var with an available serialport for more testing.');
          return;
        }

        beforeEach(function(done) {
          binding.open(testPort, defaultPortOpenOptions, done);
        });

        afterEach(function(done) {
          binding.close(done);
        });

        it('sets flags on the port', function(done) {
          binding.set(defaultSetFlags, done);
        });
      });

      describe('#read', function() {
        it('errors when not open', function(done) {
          var binding = new Binding({disconnect: function() {}});
          binding.read(function(err) {
            assert.instanceOf(err, Error);
            done();
          });
        });

        if (!testPort) {
          it('Cannot be tested further. Set the TEST_PORT env var with an available serialport for more testing.');
          return;
        }

        beforeEach(function(done) {
          binding.open(testPort, defaultPortOpenOptions, done);
        });

        afterEach(function(done) {
          binding.close(done);
        });

        it('returns data when it becomes available', function(done) {
          var readyData = new Buffer('READY');
          var newData = new Buffer('!');
          binding.read(function(err, data) {
            assert.isNull(err);
            assert.deepEqual(data.toJSON(), readyData.toJSON());

            binding.read(function(err, data) {
              assert.isNull(err);
              assert.deepEqual(data.toJSON(), newData.toJSON());
              done();
            });
            binding.write(newData, function() {});
          });
        });

        it('complains when more than one read is happening at once', function(done) {
          var readyData = new Buffer('READY');
          var newData = new Buffer('!');
          binding.read(function(err, data) {
            assert.isNull(err);
            assert.deepEqual(data.toJSON(), readyData.toJSON());

            binding.read(function(err, data) {
              assert.isNull(err);
              assert.deepEqual(data, newData);
              done();
            });
            binding.read(function(err, data) {
              assert.instanceOf(err, Error);
              assert.equal(data, undefined);
            });
            binding.write(newData, function() {});
          });
        });
      });
    });
  });
};
