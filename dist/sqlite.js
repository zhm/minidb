"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;

var _pgFormat = _interopRequireDefault(require("pg-format"));

var _util = require("util");

var _esc = _interopRequireDefault(require("./esc"));

var _database = _interopRequireDefault(require("./database"));

var _databaseCursor = _interopRequireDefault(require("./database-cursor"));

var _minisqlite = require("minisqlite");

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function quoteLiteral(value) {
  let stringValue = null;

  if (value == null) {
    return 'NULL';
  } else if (value === false) {
    return '0';
  } else if (value === true) {
    return '1';
  } else if (value instanceof Date) {
    return value.getTime().toString();
  } else if (typeof value === 'number') {
    return Number.isFinite(value) ? value.toString() : 'NULL';
  } else if (typeof value === 'string') {
    stringValue = value;
  } else {
    stringValue = JSON.stringify(value);
  }

  let result = "'";

  if (stringValue.indexOf("'") !== -1) {
    const length = stringValue.length;

    for (let i = 0; i < length; i++) {
      const char = stringValue[i];

      if (char === "'") {
        result += "'";
      }

      result += char;
    }
  } else {
    result += stringValue;
  }

  result += "'";
  return result;
}

class SQLite extends _database.default {
  async open({
    file,
    flags
  }) {
    return new Promise((resolve, reject) => {
      const database = new _minisqlite.Database();
      database.open(file, flags, null, (err, db) => {
        if (err) {
          return reject(db ? db.lastError : err);
        }

        return resolve(db);
      });
    });
  }

  async setup() {
    if (!this.database) {
      this.database = await this.open(this.options);
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
    return (0, _esc.default)(value, '"');
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
    const database = this.database;
    let cursor = null;

    try {
      cursor = this.query(sql);

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
      this._lastInsertID = database.lastInsertID;

      if (cursor) {
        try {
          await cursor.close();
        } catch (err) {// Closing the cursor on a connection where there was a previous error rethrows the same error
          // This is because pumping the cursor to completion ends up carrying the original error to
          // the end. This is desired behavior, we just have to swallow any potential errors here.
        }
      }
    }
  }

  async close() {
    if (this.database) {
      await this.database.close();
      this.database = null;
    }
  }

  async _execute(sql, params) {
    let resultColumns = null;
    const rows = [];
    await this._each(sql, [], async ({
      columns,
      values,
      index
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

  query(...args) {
    return new _databaseCursor.default(this, this.database.query(...args));
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
        // await this.close();
        throw rollbackError;
      }

      throw ex;
    } finally {// await this.close();
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
        const columnName = '`' + key + '`';

        if (value == null) {
          clause.push((0, _pgFormat.default)('%s IS NULL', columnName));
        } else if (Array.isArray(value)) {
          clause.push((0, _pgFormat.default)('%s = ANY (' + this.arrayFormatString(where[key]) + ')', columnName, value));
        } else {
          clause.push((0, _pgFormat.default)('%s = %s', columnName, quoteLiteral(where[key])));
        }
      }
    }

    return [clause, []];
  }

  buildInsert(attributes, includeNames = true) {
    const names = [];
    const values = [];
    const placeholders = []; // Use the literal values instead of placeholders  because parameterized
    // queries require prepared statements. Prepared statements are stateful
    // and impose requirements on the connection that are incompatible with
    // pgbouncer.

    for (const key of Object.keys(attributes)) {
      if (includeNames) {
        names.push('`' + key + '`');
      }

      const value = attributes[key];

      if (value && value.raw) {
        placeholders.push((0, _pgFormat.default)('%s', value.raw));
      } else {
        placeholders.push(quoteLiteral(value));
      }
    }

    return [names, placeholders, values];
  }

  buildUpdate(attributes) {
    const sets = [];
    const values = [];

    for (const key of Object.keys(attributes)) {
      const value = attributes[key];

      if (value && value.raw) {
        sets.push((0, _pgFormat.default)('%s = %s', '`' + key + '`', value.raw));
      } else {
        sets.push((0, _pgFormat.default)('%s = %s', '`' + key + '`', quoteLiteral(value)));
      }
    }

    return [sets, values];
  }

  insertStatement(table, attributes, options) {
    // if (options == null) {
    //   throw new Error('options not given');
    // }
    const [names, placeholders, values] = this.buildInsert(attributes);
    const returning = '';
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
    const result = await this.all(statement.sql, statement.values); // TODO(zhm) broken

    return this._lastInsertID; // return +result[0].id;
  }

  toDatabase(value, column) {
    if (value == null) {
      return null;
    }

    switch (column.type) {
      case 'datetime':
        return value.getTime();

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
        return new Date(+value);

      default:
        return super.fromDatabase(value, column);
    }
  }

}

exports.default = SQLite;
//# sourceMappingURL=sqlite.js.map