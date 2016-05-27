'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _minipg = require('minipg');

var _postgresCursor = require('./postgres-cursor');

var _postgresCursor2 = _interopRequireDefault(_postgresCursor);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _asyncToGenerator(fn) { return function () { var gen = fn.apply(this, arguments); return new Promise(function (resolve, reject) { function step(key, arg) { try { var info = gen[key](arg); var value = info.value; } catch (error) { reject(error); return; } if (info.done) { resolve(value); } else { return Promise.resolve(value).then(function (value) { return step("next", value); }, function (err) { return step("throw", err); }); } } return step("next"); }); }; }

const POOLS = {};

// Wrap a single connection w/ a query method in an async function.
// This is used when we need to execute multiple successive queries and make sure
// they're executed on the *same* connection and not separate connections
// from the connection pool.
class PostgresConnection {
  constructor(pool, rawClient) {
    this.pool = pool;
    this.rawClient = rawClient;
  }

  static pool(connectionString) {
    let pool = POOLS[connectionString];

    if (pool == null) {
      const params = {
        db: connectionString,
        max: 25,
        idleTimeoutMillis: PostgresConnection.idleTimeoutMillis,
        reapIntervalMillis: PostgresConnection.reapIntervalMillis
      };

      pool = POOLS[connectionString] = (0, _minipg.createPool)(params);
    }

    return pool;
  }

  query() {
    return new _postgresCursor2.default(this, this.rawClient.query(...arguments));
  }

  close() {
    this.pool.release(this.rawClient);
    this.rawClient = null;
  }

  static connect(connectionString) {
    return _asyncToGenerator(function* () {
      return new Promise(function (resolve, reject) {
        const pool = PostgresConnection.pool(connectionString);

        pool.acquire(function (err, client) {
          if (err) {
            return reject(err);
          }

          return resolve(new PostgresConnection(pool, client));
        });
      });
    })();
  }

  static shutdown() {
    for (const connection of Object.keys(POOLS)) {
      const pool = POOLS[connection];

      if (pool) {
        pool.drain(() => {
          pool.destroyAllNow();
        });
      }
    }
  }
}

exports.default = PostgresConnection;
PostgresConnection.idleTimeoutMillis = null;
PostgresConnection.reapIntervalMillis = null;
//# sourceMappingURL=postgres-connection.js.map