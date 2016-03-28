'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _slicedToArray = function () { function sliceIterator(arr, i) { var _arr = []; var _n = true; var _d = false; var _e = undefined; try { for (var _i = arr[Symbol.iterator](), _s; !(_n = (_s = _i.next()).done); _n = true) { _arr.push(_s.value); if (i && _arr.length === i) break; } } catch (err) { _d = true; _e = err; } finally { try { if (!_n && _i["return"]) _i["return"](); } finally { if (_d) throw _e; } } return _arr; } return function (arr, i) { if (Array.isArray(arr)) { return arr; } else if (Symbol.iterator in Object(arr)) { return sliceIterator(arr, i); } else { throw new TypeError("Invalid attempt to destructure non-iterable instance"); } }; }();

var _util = require('util');

var _esc = require('./esc');

var _esc2 = _interopRequireDefault(_esc);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _asyncToGenerator(fn) { return function () { var gen = fn.apply(this, arguments); return new Promise(function (resolve, reject) { function step(key, arg) { try { var info = gen[key](arg); var value = info.value; } catch (error) { reject(error); return; } if (info.done) { resolve(value); } else { return Promise.resolve(value).then(function (value) { return step("next", value); }, function (err) { return step("throw", err); }); } } return step("next"); }); }; }

class Database {
  constructor(options) {
    this.options = options;
  }

  get verbose() {
    return false;
    // return true;
  }

  ident(value) {
    return (0, _esc2.default)(value, '`');
  }

  literal(value) {
    return (0, _esc2.default)(value, "'");
  }

  open() {
    return _asyncToGenerator(function* () {})();
  }

  close() {
    return _asyncToGenerator(function* () {})();
  }

  each(sql, params, callback) {
    return _asyncToGenerator(function* () {})();
  }

  execute(sql, params) {
    return _asyncToGenerator(function* () {})();
  }

  beginTransaction() {
    return this.execute('BEGIN TRANSACTION');
  }

  commit() {
    return this.execute('COMMIT TRANSACTION');
  }

  rollback() {
    return this.execute('ROLLBACK TRANSACTION');
  }

  transaction(block) {
    var _this = this;

    return _asyncToGenerator(function* () {
      yield _this.beginTransaction();

      try {
        yield block();

        yield _this.commit();
      } catch (ex) {
        console.log('ERROR IN TRANSACTION', ex);
        yield _this.rollback();
        throw ex;
      }
    })();
  }

  all(sql, params) {
    var _this2 = this;

    return _asyncToGenerator(function* () {
      const rows = [];
      const self = _this2;

      yield self.each(sql, params, function (columns, row, index) {
        if (row) {
          rows.push(row);
        }
      });

      return rows;
    })();
  }

  get(sql, params) {
    var _this3 = this;

    return _asyncToGenerator(function* () {
      const rows = [];

      yield _this3.each(sql, params, function (columns, row, index) {
        if (row) {
          rows.push(row);
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

  findAllByAttributes(tableName, columns, where, orderBy, limit, offset) {
    const selection = columns == null ? ['*'] : columns;

    var _buildWhere = this.buildWhere(where);

    var _buildWhere2 = _slicedToArray(_buildWhere, 2);

    const clause = _buildWhere2[0];
    const values = _buildWhere2[1];


    let parts = [];

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

    return this.all(sql, values);
  }

  findFirstByAttributes(tableName, columns, attributes, orderBy) {
    var _this4 = this;

    return _asyncToGenerator(function* () {
      const rows = yield _this4.findAllByAttributes(tableName, columns, attributes, orderBy, 1);

      return rows != null ? rows[0] : null;
    })();
  }

  trace() {}

  profile(sql, time) {
    console.log('PROFILE', '(' + time + 'ms)', sql);
  }

  insert(table, attributes, options) {
    var _this5 = this;

    return _asyncToGenerator(function* () {
      var _buildInsert = _this5.buildInsert(attributes);

      var _buildInsert2 = _slicedToArray(_buildInsert, 3);

      const names = _buildInsert2[0];
      const placeholders = _buildInsert2[1];
      const values = _buildInsert2[2];


      const sql = (0, _util.format)('INSERT INTO %s (%s)\nVALUES (%s);', table, names.join(', '), placeholders.join(', '));

      yield _this5.execute(sql, values);

      return _this5.lastID;
    })();
  }

  update(table, where, attributes, options) {
    var _this6 = this;

    return _asyncToGenerator(function* () {
      const values = [];

      var _buildUpdate = _this6.buildUpdate(attributes);

      var _buildUpdate2 = _slicedToArray(_buildUpdate, 2);

      const sets = _buildUpdate2[0];
      const updateValues = _buildUpdate2[1];


      values.push.apply(values, updateValues);

      if (options && options.raw) {
        for (const name of Object.keys(options.raw)) {
          sets.push((0, _util.format)('%s = %s', name, options.raw[name]));
        }
      }

      var _buildWhere3 = _this6.buildWhere(where);

      var _buildWhere4 = _slicedToArray(_buildWhere3, 2);

      const clause = _buildWhere4[0];
      const whereValues = _buildWhere4[1];


      values.push.apply(values, whereValues);

      const whereClause = clause.length ? ' WHERE ' + clause.join(' AND ') : '';

      const sql = (0, _util.format)('UPDATE %s SET %s%s', table, sets.join(', '), whereClause);

      yield _this6.execute(sql, values);

      return null;
    })();
  }

  delete(table, where, options) {
    var _this7 = this;

    return _asyncToGenerator(function* () {
      var _buildWhere5 = _this7.buildWhere(where);

      var _buildWhere6 = _slicedToArray(_buildWhere5, 2);

      const clause = _buildWhere6[0];
      const values = _buildWhere6[1];


      const whereClause = clause.length ? ' WHERE ' + clause.join(' AND ') : '';

      const sql = (0, _util.format)('DELETE FROM %s%s', table, whereClause);

      yield _this7.execute(sql, values);

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