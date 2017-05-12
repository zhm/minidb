import PostgresConnection from './postgres-connection';
import pgformat from 'pg-format';
import { format } from 'util';
import esc from './esc';
import Database from './database';

let mssql = null;

export default class MSSQL extends Database {
  constructor(options) {
    super(options);

    this.client = options.client;
  }

  static set driver(driver) {
    mssql = driver;
    // PostgresConnection.driver = driver;
  }

  ident(value) {
    return esc(value, '"');
  }

  static async connect(db) {
    return await PostgresConnection.connect(db);
  }

  static shutdown() {
    PostgresConnection.shutdown();
  }

  get dialect() {
    return 'mssql';
  }

  async _each(sql, params, callback) {
    throw new Error('not implemented');
  }

  async close() {
    throw new Error('not implemented');
  }

  async query(sql, params) {
    throw new Error('not implemented');
  }

  async _execute(sql, params) {
    throw new Error('not implemented');
  }

  beginTransaction() {
    throw new Error('not implemented');
  }

  commit() {
    throw new Error('not implemented');
  }

  rollback() {
    throw new Error('not implemented');
  }

  async transaction(block) {
    throw new Error('not implemented');
  }

  static transaction(options, block) {
    throw new Error('not implemented');
  }

  static async using(options, block) {
    throw new Error('not implemented');
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
        const value = where[key];

        if (value == null) {
          clause.push(format('[%s] IS NULL', key));
        // } else if (Array.isArray(value)) {
        //   clause.push(pgformat('%I = ANY (' + this.arrayFormatString(where[key]) + ')', key, value));
        } else {
          clause.push(pgformat('[%s] = %L', key, value));
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
        names.push(format('[%s]', key));
      }

      const value = attributes[key];

      if (Array.isArray(value)) {
        // placeholders.push(format('ARRAY[%L]', value));
        placeholders.push(pgformat('%L', value.toString()));
      } else if (value instanceof Date) {
        placeholders.push(pgformat('%L', value.toISOString()));
      } else if (value && value.raw) {
        placeholders.push(format('%s', value.raw));
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
        // sets.push(pgformat('%I = ARRAY[%L]', key, value));
        sets.push(pgformat('[%s] = %L', key, value));
      } else if (value instanceof Date) {
        sets.push(pgformat('[%s] = %L', key, value.toISOString()));
      } else if (value && value.raw) {
        sets.push(format('[%s] = %s', value.raw));
      } else {
        sets.push(pgformat('[%s] = %L', key, value));
      }
    }

    return [ sets, values ];
  }

  insertStatement(table, attributes, options) {
    if (options == null || options.pk == null) {
      throw new Error('pk is required');
    }

    const [ names, placeholders, values ] = this.buildInsert(attributes);

    // const returning = options && options.returnPrimaryKey === false ? '' : ' RETURNING ' + options.pk;

    const sql = format('INSERT INTO %s (%s)\nVALUES (%s)%s;',
                       table,
                       names.join(', '),
                       placeholders.join(', '),
                       '');

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
