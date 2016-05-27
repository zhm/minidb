import { createPool } from 'minipg';
import PostgresCursor from './postgres-cursor';

const POOLS = {};

// Wrap a single connection w/ a query method in an async function.
// This is used when we need to execute multiple successive queries and make sure
// they're executed on the *same* connection and not separate connections
// from the connection pool.
export default class PostgresConnection {
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

      pool = POOLS[connectionString] = createPool(params);
    }

    return pool;
  }

  query(...args) {
    return new PostgresCursor(this, this.rawClient.query(...args));
  }

  close() {
    this.pool.release(this.rawClient);
    this.rawClient = null;
  }

  static async connect(connectionString) {
    return new Promise((resolve, reject) => {
      const pool = PostgresConnection.pool(connectionString);

      pool.acquire((err, client) => {
        if (err) {
          return reject(err);
        }

        return resolve(new PostgresConnection(pool, client));
      });
    });
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

PostgresConnection.idleTimeoutMillis = null;
PostgresConnection.reapIntervalMillis = null;
