'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _slicedToArray = function () { function sliceIterator(arr, i) { var _arr = []; var _n = true; var _d = false; var _e = undefined; try { for (var _i = arr[Symbol.iterator](), _s; !(_n = (_s = _i.next()).done); _n = true) { _arr.push(_s.value); if (i && _arr.length === i) break; } } catch (err) { _d = true; _e = err; } finally { try { if (!_n && _i["return"]) _i["return"](); } finally { if (_d) throw _e; } } return _arr; } return function (arr, i) { if (Array.isArray(arr)) { return arr; } else if (Symbol.iterator in Object(arr)) { return sliceIterator(arr, i); } else { throw new TypeError("Invalid attempt to destructure non-iterable instance"); } }; }();

var _postgresConnection = require('./postgres-connection');

var _postgresConnection2 = _interopRequireDefault(_postgresConnection);

var _pgFormat = require('pg-format');

var _pgFormat2 = _interopRequireDefault(_pgFormat);

var _util = require('util');

var _esc = require('./esc');

var _esc2 = _interopRequireDefault(_esc);

var _database = require('./database');

var _database2 = _interopRequireDefault(_database);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _asyncToGenerator(fn) { return function () { var gen = fn.apply(this, arguments); return new Promise(function (resolve, reject) { function step(key, arg) { try { var info = gen[key](arg); var value = info.value; } catch (error) { reject(error); return; } if (info.done) { resolve(value); } else { return Promise.resolve(value).then(function (value) { step("next", value); }, function (err) { step("throw", err); }); } } return step("next"); }); }; }

let mssql = null;

class MSSQL extends _database2.default {
  constructor(options) {
    super(options);

    this.client = options.client;
  }

  static set driver(driver) {
    mssql = driver;
    // PostgresConnection.driver = driver;
  }

  ident(value) {
    return (0, _esc2.default)(value, '"');
  }

  static connect(db) {
    return _asyncToGenerator(function* () {
      return yield _postgresConnection2.default.connect(db);
    })();
  }

  static shutdown() {
    _postgresConnection2.default.shutdown();
  }

  get dialect() {
    return 'mssql';
  }

  _each(sql, params, callback) {
    return _asyncToGenerator(function* () {
      throw new Error('not implemented');
    })();
  }

  close() {
    return _asyncToGenerator(function* () {
      throw new Error('not implemented');
    })();
  }

  query(sql, params) {
    return _asyncToGenerator(function* () {
      throw new Error('not implemented');
    })();
  }

  _execute(sql, params) {
    return _asyncToGenerator(function* () {
      throw new Error('not implemented');
    })();
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

  transaction(block) {
    return _asyncToGenerator(function* () {
      throw new Error('not implemented');
    })();
  }

  static transaction(options, block) {
    throw new Error('not implemented');
  }

  static using(options, block) {
    return _asyncToGenerator(function* () {
      throw new Error('not implemented');
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
        const value = where[key];

        if (value == null) {
          clause.push((0, _util.format)('[%s] IS NULL', key));
          // } else if (Array.isArray(value)) {
          //   clause.push(pgformat('%I = ANY (' + this.arrayFormatString(where[key]) + ')', key, value));
        } else {
          clause.push((0, _pgFormat2.default)('[%s] = %L', key, value));
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
        names.push((0, _util.format)('[%s]', key));
      }

      const value = attributes[key];

      if (Array.isArray(value)) {
        // placeholders.push(format('ARRAY[%L]', value));
        placeholders.push((0, _pgFormat2.default)('%L', value.toString()));
      } else if (value instanceof Date) {
        placeholders.push((0, _pgFormat2.default)('%L', value.toISOString()));
      } else if (value && value.raw) {
        placeholders.push((0, _util.format)('%s', value.raw));
      } else {
        placeholders.push((0, _pgFormat2.default)('%L', value));
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
        // sets.push(pgformat('%I = ARRAY[%L]', key, value));
        sets.push((0, _pgFormat2.default)('[%s] = %L', key, value));
      } else if (value instanceof Date) {
        sets.push((0, _pgFormat2.default)('[%s] = %L', key, value.toISOString()));
      } else if (value && value.raw) {
        sets.push((0, _util.format)('[%s] = %s', value.raw));
      } else {
        sets.push((0, _pgFormat2.default)('[%s] = %L', key, value));
      }
    }

    return [sets, values];
  }

  insertStatement(table, attributes, options) {
    if (options == null || options.pk == null) {
      throw new Error('pk is required');
    }

    var _buildInsert = this.buildInsert(attributes),
        _buildInsert2 = _slicedToArray(_buildInsert, 3);

    const names = _buildInsert2[0],
          placeholders = _buildInsert2[1],
          values = _buildInsert2[2];

    // const returning = options && options.returnPrimaryKey === false ? '' : ' RETURNING ' + options.pk;

    const sql = (0, _util.format)('INSERT INTO %s (%s)\nVALUES (%s)%s;', table, names.join(', '), placeholders.join(', '), '');

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
    var _this = this;

    return _asyncToGenerator(function* () {
      const statement = _this.insertStatement(table, attributes, options);

      const result = yield _this.all(statement.sql, statement.values);

      return +result[0].id;
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
exports.default = MSSQL;
//# sourceMappingURL=mssql.js.map