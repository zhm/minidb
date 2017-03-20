'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _slicedToArray = function () { function sliceIterator(arr, i) { var _arr = []; var _n = true; var _d = false; var _e = undefined; try { for (var _i = arr[Symbol.iterator](), _s; !(_n = (_s = _i.next()).done); _n = true) { _arr.push(_s.value); if (i && _arr.length === i) break; } } catch (err) { _d = true; _e = err; } finally { try { if (!_n && _i["return"]) _i["return"](); } finally { if (_d) throw _e; } } return _arr; } return function (arr, i) { if (Array.isArray(arr)) { return arr; } else if (Symbol.iterator in Object(arr)) { return sliceIterator(arr, i); } else { throw new TypeError("Invalid attempt to destructure non-iterable instance"); } }; }();

var _pgFormat = require('pg-format');

var _pgFormat2 = _interopRequireDefault(_pgFormat);

var _util = require('util');

var _esc = require('./esc');

var _esc2 = _interopRequireDefault(_esc);

var _database = require('./database');

var _database2 = _interopRequireDefault(_database);

var _databaseCursor = require('./database-cursor');

var _databaseCursor2 = _interopRequireDefault(_databaseCursor);

var _minisqlite = require('minisqlite');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _asyncToGenerator(fn) { return function () { var gen = fn.apply(this, arguments); return new Promise(function (resolve, reject) { function step(key, arg) { try { var info = gen[key](arg); var value = info.value; } catch (error) { reject(error); return; } if (info.done) { resolve(value); } else { return Promise.resolve(value).then(function (value) { step("next", value); }, function (err) { step("throw", err); }); } } return step("next"); }); }; }

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

class SQLite extends _database2.default {
  createClient(_ref) {
    let file = _ref.file;
    return _asyncToGenerator(function* () {
      return new Promise(function (resolve, reject) {
        new _minisqlite.Client().connect(file, null, null, function (err, client) {
          if (err) {
            return reject(client ? client.lastError : err);
          }

          return resolve(client);
        });
      });
    })();
  }

  setup() {
    var _this = this;

    return _asyncToGenerator(function* () {
      if (!_this.client) {
        _this.client = yield _this.createClient(_this.options);
      }

      if (_this.options.wal) {
        yield _this.execute('PRAGMA journal_mode=WAL');
      }

      if (_this.options.autoVacuum) {
        yield _this.execute('PRAGMA auto_vacuum=INCREMENTAL');
      }

      if (_this.options.synchronous) {
        yield _this.execute('PRAGMA synchronous=' + _this.options.synchronous.toUpperCase());
      }
    })();
  }

  ident(value) {
    return (0, _esc2.default)(value, '"');
  }

  static open(options) {
    return _asyncToGenerator(function* () {
      const db = new SQLite(options);
      yield db.setup();
      return db;
    })();
  }

  get dialect() {
    return 'sqlite';
  }

  _each(sql, params, callback) {
    var _this2 = this;

    return _asyncToGenerator(function* () {
      _this2.log(sql);

      const close = false;
      const client = _this2.client;
      let cursor = null;

      try {
        cursor = _this2.query(sql);

        while (cursor.hasRows) {
          const result = yield cursor.next();

          if (result && callback) {
            /* eslint-disable callback-return */
            yield callback({ columns: result.columns, values: result.values, index: result.index, cursor: cursor });
            /* eslint-enable callback-return */
          }
        }
      } catch (ex) {
        if (_this2.verbose) {
          console.error('ERROR', ex);
        }

        throw ex;
      } finally {
        _this2._lastInsertID = client.lastInsertID;

        if (cursor) {
          try {
            yield cursor.close();
          } catch (err) {
            // Closing the cursor on a connection where there was a previous error rethrows the same error
            // This is because pumping the cursor to completion ends up carrying the original error to
            // the end. This is desired behavior, we just have to swallow any potential errors here.
          }
        }

        if (close) {
          yield client.close();
        }
      }
    })();
  }

  close() {
    var _this3 = this;

    return _asyncToGenerator(function* () {
      if (_this3.client) {
        yield _this3.client.close();

        _this3.client = null;
      }
    })();
  }

  _execute(sql, params) {
    var _this4 = this;

    return _asyncToGenerator(function* () {
      let resultColumns = null;
      const rows = [];

      yield _this4._each(sql, [], (() => {
        var _ref2 = _asyncToGenerator(function* (_ref3) {
          let columns = _ref3.columns,
              values = _ref3.values,
              index = _ref3.index;

          if (resultColumns == null) {
            resultColumns = columns;
          }

          if (values) {
            rows.push(values);
          }
        });

        return function (_x) {
          return _ref2.apply(this, arguments);
        };
      })());

      return { rows: rows, columns: resultColumns };
    })();
  }

  query() {
    return new _databaseCursor2.default(this, this.client.query(...arguments));
  }

  transaction(block) {
    var _this5 = this;

    return _asyncToGenerator(function* () {
      yield _this5.beginTransaction();

      try {
        yield block(_this5);
        yield _this5.commit();
      } catch (ex) {
        try {
          yield _this5.rollback();
        } catch (rollbackError) {
          // await this.close();
          throw rollbackError;
        }

        throw ex;
      } finally {
        // await this.close();
      }
    })();
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
          clause.push((0, _pgFormat2.default)('%s = ANY (' + this.arrayFormatString(where[key]) + ')', '`' + key + '`', where[key]));
        } else {
          clause.push((0, _pgFormat2.default)('%s = %s', '`' + key + '`', quoteLiteral(where[key])));
        }
      }
    }

    return [clause, []];
  }

  buildInsert(attributes) {
    let includeNames = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : true;

    const names = [];
    const values = [];
    const placeholders = [];

    // Use the literal values instead of placeholders  because parameterized
    // queries require prepared statements. Prepared statements are stateful
    // and impose requirements on the connection that are incompatible with
    // pgbouncer.
    for (const key of Object.keys(attributes)) {
      if (includeNames) {
        names.push('`' + key + '`');
      }

      const value = attributes[key];

      if (value && value.raw) {
        placeholders.push((0, _pgFormat2.default)('%s', value.raw));
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
        sets.push((0, _pgFormat2.default)('%s = %s', '`' + key + '`', value.raw));
      } else {
        sets.push((0, _pgFormat2.default)('%s = %s', '`' + key + '`', quoteLiteral(value)));
      }
    }

    return [sets, values];
  }

  insertStatement(table, attributes, options) {
    // if (options == null) {
    //   throw new Error('options not given');
    // }

    var _buildInsert = this.buildInsert(attributes),
        _buildInsert2 = _slicedToArray(_buildInsert, 3);

    const names = _buildInsert2[0],
          placeholders = _buildInsert2[1],
          values = _buildInsert2[2];


    const returning = '';

    const sql = (0, _util.format)('INSERT INTO %s (%s)\nVALUES (%s)%s;', table, names.join(', '), placeholders.join(', '), returning);

    return { sql: sql, values: values };
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

    return { sql: sql, values: {} };
  }

  insert(table, attributes, options) {
    var _this6 = this;

    return _asyncToGenerator(function* () {
      const statement = _this6.insertStatement(table, attributes, options);

      const result = yield _this6.all(statement.sql, statement.values);

      // TODO(zhm) broken
      return _this6._lastInsertID;
      // return +result[0].id;
    })();
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
exports.default = SQLite;
//# sourceMappingURL=sqlite.js.map