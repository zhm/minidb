'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _slicedToArray = function () { function sliceIterator(arr, i) { var _arr = []; var _n = true; var _d = false; var _e = undefined; try { for (var _i = arr[Symbol.iterator](), _s; !(_n = (_s = _i.next()).done); _n = true) { _arr.push(_s.value); if (i && _arr.length === i) break; } } catch (err) { _d = true; _e = err; } finally { try { if (!_n && _i["return"]) _i["return"](); } finally { if (_d) throw _e; } } return _arr; } return function (arr, i) { if (Array.isArray(arr)) { return arr; } else if (Symbol.iterator in Object(arr)) { return sliceIterator(arr, i); } else { throw new TypeError("Invalid attempt to destructure non-iterable instance"); } }; }();

var _util = require('util');

var _esc = require('./esc');

var _esc2 = _interopRequireDefault(_esc);

var _humanizeDuration = require('humanize-duration');

var _humanizeDuration2 = _interopRequireDefault(_humanizeDuration);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _asyncToGenerator(fn) { return function () { var gen = fn.apply(this, arguments); return new Promise(function (resolve, reject) { function step(key, arg) { try { var info = gen[key](arg); var value = info.value; } catch (error) { reject(error); return; } if (info.done) { resolve(value); } else { return Promise.resolve(value).then(function (value) { step("next", value); }, function (err) { step("throw", err); }); } } return step("next"); }); }; }

const shortEnglishHumanizer = _humanizeDuration2.default.humanizer({
  language: 'shortEn',
  languages: {
    shortEn: {
      ms: () => 'ms'
    }
  }
});

class Database {
  constructor(options) {
    this.options = options;
  }

  get verbose() {
    return false;
    // return true;
  }

  log(message) {
    // if (Database.debug) {
    //   console.warn('[SQL]', message);
    // }
  }

  static measure(text, block) {
    return _asyncToGenerator(function* () {
      if (!Database.debug) {
        return yield block();
      }

      const start = new Date().getTime();

      let result = null;
      let error = null;

      try {
        result = yield block();
      } catch (ex) {
        error = ex;
      }

      const total = new Date().getTime() - start;

      console.log('[SQL][' + shortEnglishHumanizer(total, { spacer: '', units: ['ms'] }) + ']' + (error ? '[ERROR] ' : ' ') + text);

      if (error) {
        throw error;
      }

      return result;
    })();
  }

  ident(value) {
    return (0, _esc2.default)(value, '`');
  }

  literal(value) {
    return (0, _esc2.default)(value, "'");
  }

  open() {
    return _asyncToGenerator(function* () {
      return null;
    })();
  }

  close() {
    return _asyncToGenerator(function* () {
      return null;
    })();
  }

  each(sql, params, callback) {
    var _this = this;

    return _asyncToGenerator(function* () {
      return yield Database.measure(sql, _asyncToGenerator(function* () {
        return yield _this._each(sql, params, callback);
      }));
    })();
  }

  execute(sql, params) {
    var _this2 = this;

    return _asyncToGenerator(function* () {
      return yield Database.measure(sql, _asyncToGenerator(function* () {
        return yield _this2._execute(sql, params);
      }));
    })();
  }

  beginTransaction() {
    return this.execute('BEGIN TRANSACTION;');
  }

  commit() {
    return this.execute('COMMIT TRANSACTION;');
  }

  rollback() {
    return this.execute('ROLLBACK TRANSACTION;');
  }

  transaction(block) {
    var _this3 = this;

    return _asyncToGenerator(function* () {
      yield _this3.beginTransaction();

      try {
        yield block(_this3);
        yield _this3.commit();
      } catch (ex) {
        console.log('ERROR IN TRANSACTION', ex);
        yield _this3.rollback();
        throw ex;
      }
    })();
  }

  all(sql, params) {
    var _this4 = this;

    return _asyncToGenerator(function* () {
      const rows = [];

      yield _this4.each(sql, params, function (_ref3) {
        let columns = _ref3.columns,
            values = _ref3.values,
            index = _ref3.index,
            cursor = _ref3.cursor;

        if (values) {
          rows.push(values);
        }
      });

      return rows;
    })();
  }

  get(sql, params) {
    var _this5 = this;

    return _asyncToGenerator(function* () {
      const rows = [];

      yield _this5.each(sql, params, function (_ref4) {
        let columns = _ref4.columns,
            values = _ref4.values,
            index = _ref4.index,
            cursor = _ref4.cursor;

        if (values) {
          rows.push(values);
        }
      });

      return rows.length ? rows[0] : null;
    })();
  }

  buildWhere(where) {
    const clause = [];
    const values = [];

    if (where) {
      for (const key of Object.keys(where)) {
        clause.push(this.ident(key) + ' = ?');
        values.push(where[key]);
      }
    }

    return [clause, values];
  }

  buildInsert(attributes) {
    const names = [];
    const values = [];
    const placeholders = [];

    for (const key of Object.keys(attributes)) {
      names.push(this.ident(key));
      placeholders.push('?');

      const value = attributes[key];

      if (Array.isArray(value)) {
        values.push('\t' + value.join('\t') + '\t');
      } else {
        values.push(value);
      }
    }

    return [names, placeholders, values];
  }

  buildUpdate(attributes) {
    const sets = [];
    const values = [];

    for (const name of Object.keys(attributes)) {
      sets.push(this.ident(name) + ' = ?');

      const value = attributes[name];

      if (Array.isArray(value)) {
        values.push('\t' + value.join('\t') + '\t');
      } else {
        values.push(value);
      }
    }

    return [sets, values];
  }

  findEachByAttributes(options, callback) {
    const statement = this.findStatement(options.tableName, options.columns, options.where, options.orderBy, options.limit, options.offset);

    return this.each(statement.sql, statement.values, callback);
  }

  findAllByAttributes(tableName, columns, where, orderBy, limit, offset) {
    const statement = this.findStatement(tableName, columns, where, orderBy, limit, offset);

    return this.all(statement.sql, statement.values);
  }

  findFirstByAttributes(tableName, columns, attributes, orderBy) {
    var _this6 = this;

    return _asyncToGenerator(function* () {
      const rows = yield _this6.findAllByAttributes(tableName, columns, attributes, orderBy, 1);

      return rows != null ? rows[0] : null;
    })();
  }

  trace() {
    return null;
  }

  profile(sql, time) {
    console.log('PROFILE', '(' + time + 'ms)', sql);
  }

  findStatement(tableName, columns, where, orderBy, limit, offset) {
    const selection = columns == null ? ['*'] : columns;

    var _buildWhere = this.buildWhere(where),
        _buildWhere2 = _slicedToArray(_buildWhere, 2);

    const clause = _buildWhere2[0],
          values = _buildWhere2[1];


    const parts = [];

    if (clause.length > 0) {
      parts.push((0, _util.format)(' WHERE %s', clause.join(' AND ')));
    }

    if (orderBy != null) {
      parts.push((0, _util.format)(' ORDER BY %s', orderBy));
    }

    if (limit != null) {
      parts.push((0, _util.format)(' LIMIT %s', this.literal(limit)));
    }

    if (offset != null) {
      parts.push((0, _util.format)(' OFFSET %s', this.literal(offset)));
    }

    const sql = (0, _util.format)('SELECT %s FROM %s%s', selection.join(', '), this.ident(tableName), parts.join(''));

    return { sql: sql, values: values };
  }

  insertStatement(table, attributes) {
    var _buildInsert = this.buildInsert(attributes),
        _buildInsert2 = _slicedToArray(_buildInsert, 3);

    const names = _buildInsert2[0],
          placeholders = _buildInsert2[1],
          values = _buildInsert2[2];


    const sql = (0, _util.format)('INSERT INTO %s (%s)\nVALUES (%s);', table, names.join(', '), placeholders.join(', '));

    return { sql: sql, values: values };
  }

  updateStatement(table, where, attributes, options) {
    const values = [];

    var _buildUpdate = this.buildUpdate(attributes),
        _buildUpdate2 = _slicedToArray(_buildUpdate, 2);

    const sets = _buildUpdate2[0],
          updateValues = _buildUpdate2[1];


    values.push.apply(values, updateValues);

    if (options && options.raw) {
      for (const name of Object.keys(options.raw)) {
        sets.push((0, _util.format)('%s = %s', name, options.raw[name]));
      }
    }

    var _buildWhere3 = this.buildWhere(where),
        _buildWhere4 = _slicedToArray(_buildWhere3, 2);

    const clause = _buildWhere4[0],
          whereValues = _buildWhere4[1];


    values.push.apply(values, whereValues);

    const whereClause = clause.length ? ' WHERE ' + clause.join(' AND ') : '';

    const sql = (0, _util.format)('UPDATE %s SET %s%s;', table, sets.join(', '), whereClause);

    return { sql: sql, values: values };
  }

  deleteStatement(table, where) {
    var _buildWhere5 = this.buildWhere(where),
        _buildWhere6 = _slicedToArray(_buildWhere5, 2);

    const clause = _buildWhere6[0],
          values = _buildWhere6[1];


    const whereClause = clause.length ? ' WHERE ' + clause.join(' AND ') : '';

    const sql = (0, _util.format)('DELETE FROM %s%s;', table, whereClause);

    return { sql: sql, values: values };
  }

  insert(table, attributes, options) {
    var _this7 = this;

    return _asyncToGenerator(function* () {
      const statement = _this7.insertStatement(table, attributes);

      yield _this7.execute(statement.sql, statement.values);

      return _this7.lastID;
    })();
  }

  update(table, where, attributes, options) {
    var _this8 = this;

    return _asyncToGenerator(function* () {
      const statement = _this8.updateStatement(table, where, attributes, options);

      yield _this8.execute(statement.sql, statement.values);

      return null;
    })();
  }

  delete(table, where, options) {
    var _this9 = this;

    return _asyncToGenerator(function* () {
      const statement = _this9.deleteStatement(table, where);

      yield _this9.execute(statement.sql, statement.values);

      return null;
    })();
  }

  toDatabase(value, column) {
    if (value == null) {
      return null;
    }

    switch (column.type) {
      case 'string':
        return value.toString();

      case 'integer':
        return +value;

      case 'double':
        return +value;

      case 'boolean':
        return !!value;

      case 'datetime':
        return value;

      case 'json':
        return JSON.stringify(value);

      default:
        return value.toString();
    }
  }

  fromDatabase(value, column) {
    if (value == null) {
      return null;
    }

    switch (column.type) {
      case 'string':
        return value.toString();

      case 'integer':
        return +value;

      case 'double':
        return +value;

      case 'boolean':
        return !!value;

      case 'datetime':
        return new Date(+value);

      case 'json':
        return JSON.parse(value);

      default:
        return value.toString();
    }
  }
}
exports.default = Database;
//# sourceMappingURL=database.js.map