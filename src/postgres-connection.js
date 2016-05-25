import { createPool } from 'minipg';

const pools = {};

// Wrap a single connection w/ a query method in an async function.
// This is used when we need to execute multiple successive queries and make sure
// they're executed on the *same* connection and not separate connections
// from the connection pool.
async function postgresConnection(connection) {
  let pool = pools[connection];

  if (pool == null) {
    const params = {
      db: connection,
      max: 25,
      idleTimeoutMillis: postgresConnection.idleTimeoutMillis,
      reapIntervalMillis: postgresConnection.reapIntervalMillis
    };

    pool = pools[connection] = createPool(params);
  }

  return new Promise((resolve, reject) => {
    pool.acquire((err, client) => {
      if (err) {
        reject(err);
        return;
      }

      // return a little object with a query method and a done method
      const result = {
        rawClient: client,

        query() {
          const cursor = client.query.apply(client, arguments);

          const obj = {
            isFinished: false,

            async next() {
              return new Promise((res, rej) => {
                cursor.next((err, finished, columns, values, index) => {
                  obj.isFinished = finished;

                  if (err) {
                    return rej(err);
                  }

                  return res({columns: columns, values: values});
                });
              });
            },

            async close() {
              // exhaust the cursor to completion
              while (!cursor.finished) {
                try {
                  await this.next();
                } catch (ex) {
                  console.warn('exception while closing cursor', ex);
                }
              }
            }
          };

          return obj;
        },

        async done() {
          pool.release(client);
        }
      };

      resolve(result);
    });
  });
}

postgresConnection.shutdown = () => {
  for (const connection of Object.keys(pools)) {
    const pool = pools[connection];

    if (pool) {
      pool.drain(() => {
        pool.destroyAllNow();
      });
    }
  }
};

postgresConnection.idleTimeoutMillis = null;
postgresConnection.reapIntervalMillis = null;

export default postgresConnection;
