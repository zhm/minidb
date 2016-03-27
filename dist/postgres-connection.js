'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _minipg = require('minipg');

var _minipg2 = _interopRequireDefault(_minipg);

var _bluebird = require('bluebird');

var _bluebird2 = _interopRequireDefault(_bluebird);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _asyncToGenerator(fn) { return function () { var gen = fn.apply(this, arguments); return new _bluebird2.default(function (resolve, reject) { function step(key, arg) { try { var info = gen[key](arg); var value = info.value; } catch (error) { reject(error); return; } if (info.done) { resolve(value); } else { return _bluebird2.default.resolve(value).then(function (value) { return step("next", value); }, function (err) { return step("throw", err); }); } } return step("next"); }); }; }

const pools = {};

// Wrap a single connection w/ a query method in an async function.
// This is used when we need to execute multiple successive queries and make sure
// they're executed on the *same* connection and not separate connections
// from the connection pool.

let connect = function () {
  var ref = _asyncToGenerator(function* (connection) {
    let pool = pools[connection];

    if (pool == null) {
      const params = {
        db: connection,
        max: 25,
        idleTimeoutMillis: connect.idleTimeoutMillis,
        reapIntervalMillis: connect.reapIntervalMillis
      };

      pool = pools[connection] = _minipg2.default.createPool(params);
    }

    return new _bluebird2.default(function (resolve, reject) {
      pool.acquire(function (err, client) {
        if (err) {
          return reject(err);
        }

        // return a little object with a query method and a done method
        const result = {
          rawClient: client,

          query: function query() {
            const cursor = client.query.apply(client, arguments);

            return {
              next: function next() {
                return _asyncToGenerator(function* () {
                  return new _bluebird2.default(function (res, rej) {
                    cursor.next(function (err, finished, columns, values, index) {
                      if (err) {
                        return rej(err);
                      }

                      return res({ columns: columns, values: values });
                    });
                  });
                })();
              },
              close: function close() {
                var _this = this;

                return _asyncToGenerator(function* () {
                  // exhaust the cursor to completion
                  while (!cursor.finished()) {
                    try {
                      yield _this.next();
                    } catch (ex) {
                      console.warn('exception while closing cursor', ex);
                    }
                  }
                })();
              }
            };
          },
          done: function done() {
            return _asyncToGenerator(function* () {
              pool.release(client);
            })();
          }
        };

        return resolve(result);
      });
    });
  });

  return function connect(_x) {
    return ref.apply(this, arguments);
  };
}();

connect.idleTimeoutMillis = null;
connect.reapIntervalMillis = null;

exports.default = connect;
//# sourceMappingURL=postgres-connection.js.map