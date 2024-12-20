"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;
var _postgresConnection = _interopRequireDefault(require("./postgres-connection"));
var _pg = _interopRequireDefault(require("pg"));
var _pgFormat = _interopRequireDefault(require("pg-format"));
var _util = require("util");
var _esc = _interopRequireDefault(require("./esc"));
var _database = _interopRequireDefault(require("./database"));
function _interopRequireDefault(e) { return e && e.__esModule ? e : { default: e }; }
// Parse bigints as `Number` objects. If a caller *really* knows their
// number cannot fit in a JS Number, it can be casted to `text` in
// the query and parsed manually. Without this, dead simple COUNT(*)
// queries are returned as text and it makes doing simple things hard.
_pg.default.types.setTypeParser(20, val => {
  return val == null ? null : parseInt(val, 10);
});
let minipg = null;
class Postgres extends _database.default {
  constructor(options) {
    super(options);
    this.client = options.client;
  }
  static set driver(driver) {
    minipg = driver;
    _postgresConnection.default.driver = driver;
  }
  ident(value) {
    return (0, _esc.default)(value, '"');
  }
  static setNoticeProcessor(processor) {
    minipg.Client.defaultNoticeProcessor = processor;
  }
  static async connect(db) {
    return await _postgresConnection.default.connect(db);
  }
  static shutdown() {
    _postgresConnection.default.shutdown();
  }
  get dialect() {
    return 'postgresql';
  }
  async _each(sql, params, callback) {
    this.log(sql);
    let close = false;
    let client = this.client;
    let cursor = null;
    if (client == null) {
      close = true;
      client = await Postgres.connect(this.options);
    }
    try {
      cursor = client.query(sql);
      while (cursor.hasRows) {
        const result = await cursor.next();
        if (result && callback) {
          /* eslint-disable callback-return */
          await callback({
            columns: result.columns,
            values: result.values,
            index: result.index,
            cursor
          });
          /* eslint-enable callback-return */
        }
      }
    } catch (ex) {
      if (this.verbose) {
        console.error('ERROR', ex);
      }
      throw ex;
    } finally {
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
  async query(sql, params) {
    this.log(sql);
    let client = this.client;
    if (client == null) {
      client = await Postgres.connect(this.options.db);
    }
    return client.query(sql, params);
  }
  async _execute(sql, params) {
    let resultColumns = null;
    const rows = [];
    await this._each(sql, [], async ({
      columns,
      values,
      index,
      cursor
    }) => {
      if (resultColumns == null) {
        resultColumns = columns;
      }
      if (values) {
        rows.push(values);
      }
    });
    return {
      rows: rows,
      columns: resultColumns
    };
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
    const client = await Postgres.connect(this.options);
    const db = new Postgres(Object.assign({}, this.options, {
      client: client
    }));
    await db.beginTransaction();
    try {
      await block(db);
      await db.commit();
    } catch (ex) {
      try {
        await db.rollback();
      } catch (rollbackError) {
        await db.close();
        throw rollbackError;
      }
      throw ex;
    } finally {
      await db.close();
    }
  }
  static transaction(options, block) {
    if (options instanceof Postgres) {
      return options.transaction(block);
    }
    return new Postgres(options).transaction(block);
  }
  static async using(options, block) {
    const connection = await Postgres.connect(options);
    const db = new Postgres(Object.assign({}, options, {
      client: connection
    }));
    try {
      await block(db);
    } finally {
      await connection.close();
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
        const value = where[key];
        if (value == null) {
          clause.push((0, _pgFormat.default)('%I IS NULL', key));
        } else if (Array.isArray(value)) {
          clause.push(value.length ? (0, _pgFormat.default)('%I = ANY (' + this.arrayFormatString(where[key]) + ')', key, value) : (0, _pgFormat.default)('%I = ANY (%L)', key, '{}'));
        } else {
          clause.push((0, _pgFormat.default)('%I = %L', key, value));
        }
      }
    }
    return [clause, []];
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
        names.push((0, _pgFormat.default)('%I', key));
      }
      const value = attributes[key];
      if (Array.isArray(value)) {
        placeholders.push(value.length ? (0, _pgFormat.default)('ARRAY[%L]', value) : "'{}'");
      } else if (value && value.raw) {
        placeholders.push((0, _pgFormat.default)('%s', value.raw));
      } else {
        placeholders.push((0, _pgFormat.default)('%L', value));
      }
    }
    return [names, placeholders, values];
  }
  buildUpdate(attributes) {
    const sets = [];
    const values = [];
    for (const key of Object.keys(attributes)) {
      const value = attributes[key];
      if (Array.isArray(value)) {
        sets.push(value.length ? (0, _pgFormat.default)('%I = ARRAY[%L]', key, value) : (0, _pgFormat.default)('%I = %L', key, '{}'));
      } else if (value && value.raw) {
        sets.push((0, _pgFormat.default)('%I = %s', value.raw));
      } else {
        sets.push((0, _pgFormat.default)('%I = %L', key, value));
      }
    }
    return [sets, values];
  }
  insertStatement(table, attributes, options) {
    if (options == null || options.pk == null) {
      throw new Error('pk is required');
    }
    const [names, placeholders, values] = this.buildInsert(attributes);
    const returning = options && options.returnPrimaryKey === false ? '' : ' RETURNING ' + options.pk;
    const sql = (0, _util.format)('INSERT INTO %s (%s)\nVALUES (%s)%s;', table, names.join(', '), placeholders.join(', '), returning);
    return {
      sql,
      values
    };
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
    const sql = (0, _util.format)('INSERT INTO %s (%s)\nVALUES %s;', table, names.join(', '), arrayOfValues.join(',\n'));
    return {
      sql,
      values: {}
    };
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
exports.default = Postgres;
//# sourceMappingURL=postgres.js.map