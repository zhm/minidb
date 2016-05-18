import postgresConnection from './postgres-connection';
import pg from 'pg';
import { Client } from 'minipg';
import pgformat from 'pg-format';
import { format } from 'util';
import esc from './esc';
import Database from './database';

// Parse bigints as `Number` objects. If a caller *really* knows their
// number cannot fit in a JS Number, it can be casted to `text` in
// the query and parsed manually. Without this, dead simple COUNT(*)
// queries are returned as text and it makes doing simple things hard.
pg.types.setTypeParser(20, (val) => {
  return val == null ? null : parseInt(val, 10);
});

export default class Postgres extends Database {
  constructor(options) {
    super(options);

    this.client = options.client;
  }

  ident(value) {
    return esc(value, '"');
  }

  static setNoticeProcessor(processor) {
    Client.defaultNoticeProcessor = processor;
  }

  static async connect(db) {
    return await postgresConnection(db);
  }

  static shutdown() {
    postgresConnection.shutdown();
  }

  get dialect() {
    return 'postgresql';
  }

  async each(sql, params, callback) {
    const exec = (client) => {
      return new Promise((resolve, reject) => {
        client.rawClient.query(sql).each((err, finished, columns, values, index) => {
          if (err) {
            return reject(err);
          } else if (finished) {
            return resolve(null);
          }

          if (!callback) {
            return null;
          }

          let parsedValues = null;

          if (values) {
            parsedValues = {};

            for (let i = 0; i < columns.length; ++i) {
              let value = values[i];

              if (value != null) {
                value = pg.types.getTypeParser(columns[i].type)(value);
              }

              parsedValues[columns[i].name] = value;
            }
          }

          return callback(columns, parsedValues, index);
        });
      });
    };

    let close = false;
    let client = this.client;

    if (client == null) {
      close = true;
      client = await Postgres.connect(this.options.db);
    }

    try {
      await exec(client);
    } catch (ex) {
      if (this.verbose) {
        console.error('ERROR', ex);
      }

      if (close) {
        await client.done();
      }

      throw ex;
    }

    if (close) {
      await client.done();
    }
  }

  async close() {
    if (this.client) {
      await this.client.done();

      this.client = null;
    }
  }

  async execute(sql, params) {
    return await this.each(sql, [], null);
  }

  beginTransaction() {
    if (this.client == null) {
      throw new Error('client is null when beginning a transaction');
    }

    return this.execute('BEGIN TRANSACTION;');
  }

  commit() {
    if (this.client == null) {
      throw new Error('client is null when committing a transaction');
    }

    return this.execute('COMMIT TRANSACTION;');
  }

  rollback() {
    if (this.client == null) {
      throw new Error('client is null when rolling back a transaction');
    }

    return this.execute('ROLLBACK TRANSACTION;');
  }

  async transaction(block) {
    // get a connection from the pool and make sure it gets used throughout the
    // transaction block.
    const client = await Postgres.connect(this.options.db);

    const db = new Postgres(Object.assign({}, this.options, {client: client}));

    await db.beginTransaction();

    try {
      await block(db);
      await db.commit();
      await db.close();
    } catch (ex) {
      await db.rollback();
      throw ex;
    }
  }

  buildWhere(where) {
    const clause = [];

    if (where) {
      for (const key of Object.keys(where)) {
        clause.push(pgformat('%I = %L', key, where[key]));
      }
    }

    return [ clause, [] ];
  }

  buildInsert(attributes) {
    const names = [];
    const values = [];
    const placeholders = [];

    // Use the literal values instead of placeholders  because parameterized
    // queries require prepared statements. Prepared statements are stateful
    // and impose requirements on the connection that are incompatible with
    // pgbouncer.
    for (const key of Object.keys(attributes)) {
      names.push(pgformat('%I', key));

      const value = attributes[key];

      if (Array.isArray(value)) {
        placeholders.push(pgformat('ARRAY[%L]', value));
      } else {
        placeholders.push(pgformat('%L', value));
      }
    }

    return [ names, placeholders, values ];
  }

  buildUpdate(attributes) {
    const sets = [];
    const values = [];

    for (const key of Object.keys(attributes)) {
      const value = attributes[key];

      if (Array.isArray(value)) {
        sets.push(pgformat('%I = ARRAY[%L]', key, value));
      } else {
        sets.push(pgformat('%I = %L', key, value));
      }
    }

    return [ sets, values ];
  }

  async insert(table, attributes, options) {
    if (options == null || options.pk == null) {
      throw new Error('pk is required');
    }

    const [ names, placeholders, values ] = this.buildInsert(attributes);

    const sql = format('INSERT INTO %s (%s)\nVALUES (%s) RETURNING %s;',
                       table,
                       names.join(', '),
                       placeholders.join(', '),
                       options.pk);

    const result = await this.all(sql, values);

    return +result[0].id;
  }

  toDatabase(value, column) {
    if (value == null) {
      return null;
    }

    switch (column.type) {
      case 'datetime':
        return value.toISOString();

      default:
        return super.toDatabase(value, column);
    }
  }

  fromDatabase(value, column) {
    if (value == null) {
      return null;
    }

    switch (column.type) {
      case 'datetime':
        return new Date(value);

      default:
        return super.fromDatabase(value, column);
    }
  }
}
