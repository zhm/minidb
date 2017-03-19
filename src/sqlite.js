import pgformat from 'pg-format';
import { format } from 'util';
import esc from './esc';
import Database from './database';
import DatabaseCursor from './database-cursor';
import { Client } from 'minisqlite';

export default class SQLite extends Database {
  async createClient({file}) {
    return new Promise((resolve, reject) => {
      new Client().connect(file, null, null, (err, client) => {
        if (err) {
          return reject(client ? client.lastError : err);
        }

        return resolve(client);
      });
    });
  }

  async setup() {
    if (!this.client) {
      this.client = await this.createClient(this.options);
    }

    if (this.options.wal) {
      await this.execute('PRAGMA journal_mode=WAL');
    }

    if (this.options.autoVacuum) {
      await this.execute('PRAGMA auto_vacuum=INCREMENTAL');
    }

    if (this.options.synchronous) {
      await this.execute('PRAGMA synchronous=' + this.options.synchronous.toUpperCase());
    }
  }

  ident(value) {
    return esc(value, '"');
  }

  static async open(options) {
    const db = new SQLite(options);
    await db.setup();
    return db;
  }

  get dialect() {
    return 'sqlite';
  }

  async _each(sql, params, callback) {
    this.log(sql);

    const close = false;
    const client = this.client;
    let cursor = null;

    try {
      cursor = this.query(sql);

      while (cursor.hasRows) {
        const result = await cursor.next();

        if (result && callback) {
          /* eslint-disable callback-return */
          await callback({columns: result.columns, values: result.values, index: result.index, cursor});
          /* eslint-enable callback-return */
        }
      }
    } catch (ex) {
      if (this.verbose) {
        console.error('ERROR', ex);
      }

      throw ex;
    } finally {
      this._lastInsertID = client.lastInsertID;

      if (cursor) {
        try {
          await cursor.close();
        } catch (err) {
          // Closing the cursor on a connection where there was a previous error rethrows the same error
          // This is because pumping the cursor to completion ends up carrying the original error to
          // the end. This is desired behavior, we just have to swallow any potential errors here.
        }
      }

      if (close) {
        await client.close();
      }
    }
  }

  async close() {
    if (this.client) {
      await this.client.close();

      this.client = null;
    }
  }

  async _execute(sql, params) {
    let resultColumns = null;
    const rows = [];

    await this._each(sql, [], async ({columns, values, index}) => {
      if (resultColumns == null) {
        resultColumns = columns;
      }

      if (values) {
        rows.push(values);
      }
    });

    return { rows: rows, columns: resultColumns };
  }

  query(...args) {
    return new DatabaseCursor(this, this.client.query(...args));
  }

  async transaction(block) {
    await this.beginTransaction();

    try {
      await block(this);
      await this.commit();
    } catch (ex) {
      try {
        await this.rollback();
      } catch (rollbackError) {
        await this.close();
        throw rollbackError;
      }

      throw ex;
    } finally {
      await this.close();
    }
  }

  arrayFormatString(array) {
    if (Number.isInteger(array[0])) {
      return 'ARRAY[%L]::bigint[]';
    } else if (typeof array[0] === 'number') {
      return 'ARRAY[%L]::double precision[]';
    }

    return 'ARRAY[%L]';
  }

  buildWhere(where) {
    const clause = [];

    if (where) {
      for (const key of Object.keys(where)) {
        if (Array.isArray(where[key])) {
          clause.push(pgformat('%I = ANY (' + this.arrayFormatString(where[key]) + ')', key, where[key]));
        } else {
          clause.push(pgformat('%I = %L', key, where[key]));
        }
      }
    }

    return [ clause, [] ];
  }

  buildInsert(attributes, includeNames = true) {
    const names = [];
    const values = [];
    const placeholders = [];

    // Use the literal values instead of placeholders  because parameterized
    // queries require prepared statements. Prepared statements are stateful
    // and impose requirements on the connection that are incompatible with
    // pgbouncer.
    for (const key of Object.keys(attributes)) {
      if (includeNames) {
        names.push(pgformat('%I', key));
      }

      const value = attributes[key];

      if (Array.isArray(value)) {
        placeholders.push(pgformat('ARRAY[%L]', value));
      } else if (value && value.raw) {
        placeholders.push(pgformat('%s', value.raw));
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
      } else if (value && value.raw) {
        sets.push(pgformat('%I = %s', value.raw));
      } else {
        sets.push(pgformat('%I = %L', key, value));
      }
    }

    return [ sets, values ];
  }

  insertStatement(table, attributes, options) {
    // if (options == null) {
    //   throw new Error('options not given');
    // }

    const [ names, placeholders, values ] = this.buildInsert(attributes);

    const returning = '';

    const sql = format('INSERT INTO %s (%s)\nVALUES (%s)%s;',
                       table,
                       names.join(', '),
                       placeholders.join(', '),
                       returning);

    return {sql, values};
  }

  insertStatements(table, arrayOfAttributes, options) {
    const arrayOfValues = [];

    let names = null;

    for (const attributes of arrayOfAttributes) {
      const insert = this.buildInsert(attributes, names == null);

      if (names == null) {
        names = insert[0];
      }

      arrayOfValues.push('(' + insert[1].join(', ') + ')');
    }

    const sql = format('INSERT INTO %s (%s)\nVALUES %s;',
                       table,
                       names.join(', '),
                       arrayOfValues.join(',\n'));

    return {sql, values: {}};
  }

  async insert(table, attributes, options) {
    const statement = this.insertStatement(table, attributes, options);

    const result = await this.all(statement.sql, statement.values);

    // TODO(zhm) broken
    return this._lastInsertID;
    // return +result[0].id;
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

