import { createPool } from 'minipg';
// import Promise from 'bluebird';

const pools = {};

// Wrap a single connection w/ a query method in an async function.
// This is used when we need to execute multiple successive queries and make sure
// they're executed on the *same* connection and not separate connections
// from the connection pool.
async function connect(connection) {
  let pool = pools[connection];

  if (pool == null) {
    const params = {
      db: connection,
      max: 25,
      idleTimeoutMillis: connect.idleTimeoutMillis,
      reapIntervalMillis: connect.reapIntervalMillis
    };

    pool = pools[connection] = createPool(params);
  }

  return new Promise((resolve, reject) => {
    pool.acquire(function(err, client) {
      if (err) {
        return reject(err);
      }

      // return a little object with a query method and a done method
      const result = {
        rawClient: client,

        query() {
          const cursor = client.query.apply(client, arguments);

          return {
            async next() {
              return new Promise((res, rej) => {
                cursor.next(function(err, finished, columns, values, index) {
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
        },

        async done() {
          pool.release(client);
        }
      };

      return resolve(result);
    });
  });
}

connect.shutdown = function() {
  for (const connection of Object.keys(pools)) {
    const pool = pools[connection];

    if (pool) {
      pool.drain(() => {
        pool.destroyAllNow();
      });
    }
  }
};

connect.idleTimeoutMillis = null;
connect.reapIntervalMillis = null;

export default connect;
