"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});

function _asyncToGenerator(fn) { return function () { var gen = fn.apply(this, arguments); return new Promise(function (resolve, reject) { function step(key, arg) { try { var info = gen[key](arg); var value = info.value; } catch (error) { reject(error); return; } if (info.done) { resolve(value); } else { return Promise.resolve(value).then(function (value) { step("next", value); }, function (err) { step("throw", err); }); } } return step("next"); }); }; }

const POOLS = {};

// Wrap a single connection w/ a query method in an async function.
// This is used when we need to execute multiple successive queries and make sure
// they're executed on the *same* connection and not separate connections
// from the connection pool.
class DatabaseConnection {
  constructor(pool, rawClient) {
    this.pool = pool;
    this.rawClient = rawClient;
  }

  static pool(connectionString) {
    // implement
  }

  static connect(options) {
    // implement

    return _asyncToGenerator(function* () {})();
  }

  query() {
    // return new PostgresCursor(this, this.rawClient.query(...args));
  }

  close() {
    this.pool.release(this.rawClient);
    this.rawClient = null;
  }

  static _connect(ConnectionClass, options) {
    return _asyncToGenerator(function* () {
      return new Promise(function (resolve, reject) {
        const pool = ConnectionClass.pool(options.db);

        pool.acquire(function (err, client) {
          if (err) {
            return reject(err);
          }

          return resolve(new ConnectionClass(pool, client));
        });
      });
    })();
  }

  static _pool(createPool, connectionString) {
    let pool = POOLS[connectionString];

    if (pool == null) {
      const params = {
        db: connectionString,
        max: DatabaseConnection.maxConnections,
        idleTimeoutMillis: DatabaseConnection.idleTimeoutMillis,
        reapIntervalMillis: DatabaseConnection.reapIntervalMillis
      };

      pool = POOLS[connectionString] = createPool(params);
    }

    return pool;
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

exports.default = DatabaseConnection;
DatabaseConnection.maxConnections = null;
DatabaseConnection.idleTimeoutMillis = null;
DatabaseConnection.reapIntervalMillis = null;
//# sourceMappingURL=database-connection.js.map