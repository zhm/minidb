'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _slicedToArray = function () { function sliceIterator(arr, i) { var _arr = []; var _n = true; var _d = false; var _e = undefined; try { for (var _i = arr[Symbol.iterator](), _s; !(_n = (_s = _i.next()).done); _n = true) { _arr.push(_s.value); if (i && _arr.length === i) break; } } catch (err) { _d = true; _e = err; } finally { try { if (!_n && _i["return"]) _i["return"](); } finally { if (_d) throw _e; } } return _arr; } return function (arr, i) { if (Array.isArray(arr)) { return arr; } else if (Symbol.iterator in Object(arr)) { return sliceIterator(arr, i); } else { throw new TypeError("Invalid attempt to destructure non-iterable instance"); } }; }();

var _postgresConnection = require('./postgres-connection');

var _postgresConnection2 = _interopRequireDefault(_postgresConnection);

var _pg = require('pg');

var _pg2 = _interopRequireDefault(_pg);

var _minipg = require('minipg');

var _pgFormat = require('pg-format');

var _pgFormat2 = _interopRequireDefault(_pgFormat);

var _util = require('util');

var _esc = require('./esc');

var _esc2 = _interopRequireDefault(_esc);

var _database = require('./database');

var _database2 = _interopRequireDefault(_database);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _asyncToGenerator(fn) { return function () { var gen = fn.apply(this, arguments); return new Promise(function (resolve, reject) { function step(key, arg) { try { var info = gen[key](arg); var value = info.value; } catch (error) { reject(error); return; } if (info.done) { resolve(value); } else { return Promise.resolve(value).then(function (value) { return step("next", value); }, function (err) { return step("throw", err); }); } } return step("next"); }); }; }

// Parse bigints as `Number` objects. If a caller *really* knows their
// number cannot fit in a JS Number, it can be casted to `text` in
// the query and parsed manually. Without this, dead simple COUNT(*)
// queries are returned as text and it makes doing simple things hard.
_pg2.default.types.setTypeParser(20, val => {
  return val == null ? null : parseInt(val, 10);
});

class Postgres extends _database2.default {
  constructor(options) {
    super(options);

    this.client = options.client;
  }

  ident(value) {
    return (0, _esc2.default)(value, '"');
  }

  static setNoticeProcessor(processor) {
    _minipg.Client.defaultNoticeProcessor = processor;
  }

  static connect(db) {
    return _asyncToGenerator(function* () {
      return yield (0, _postgresConnection2.default)(db);
    })();
  }

  static shutdown() {
    _postgresConnection2.default.shutdown();
  }

  get dialect() {
    return 'postgresql';
  }

  each(sql, params, callback) {
    var _this = this;

    return _asyncToGenerator(function* () {
      const exec = function exec(client) {
        return new Promise(function (resolve, reject) {
          client.rawClient.query(sql).each(function (err, finished, columns, values, index) {
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
                  value = _pg2.default.types.getTypeParser(columns[i].type)(value);
                }

                parsedValues[columns[i].name] = value;
              }
            }

            return callback(columns, parsedValues, index);
          });
        });
      };

      let close = false;
      let client = _this.client;

      if (client == null) {
        close = true;
        client = yield Postgres.connect(_this.options.db);
      }

      try {
        yield exec(client);
      } catch (ex) {
        if (_this.verbose) {
          console.error('ERROR', ex);
        }

        if (close) {
          yield client.done();
        }

        throw ex;
      }

      if (close) {
        yield client.done();
      }
    })();
  }

  close() {
    var _this2 = this;

    return _asyncToGenerator(function* () {
      if (_this2.client) {
        yield _this2.client.done();

        _this2.client = null;
      }
    })();
  }

  execute(sql, params) {
    var _this3 = this;

    return _asyncToGenerator(function* () {
      return yield _this3.each(sql, [], null);
    })();
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

  transaction(block) {
    var _this4 = this;

    return _asyncToGenerator(function* () {
      // get a connection from the pool and make sure it gets used throughout the
      // transaction block.
      const client = yield Postgres.connect(_this4.options.db);

      const db = new Postgres(Object.assign({}, _this4.options, { client: client }));

      yield db.beginTransaction();

      try {
        yield block(db);
        yield db.commit();
        yield db.close();
      } catch (ex) {
        yield db.rollback();
        throw ex;
      }
    })();
  }

  buildWhere(where) {
    const clause = [];

    if (where) {
      for (const key of Object.keys(where)) {
        clause.push((0, _pgFormat2.default)('%I = %L', key, where[key]));
      }
    }

    return [clause, []];
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
      names.push((0, _pgFormat2.default)('%I', key));

      const value = attributes[key];

      if (Array.isArray(value)) {
        placeholders.push((0, _pgFormat2.default)('ARRAY[%L]', value));
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
        sets.push((0, _pgFormat2.default)('%I = ARRAY[%L]', key, value));
      } else {
        sets.push((0, _pgFormat2.default)('%I = %L', key, value));
      }
    }

    return [sets, values];
  }

  insert(table, attributes, options) {
    var _this5 = this;

    return _asyncToGenerator(function* () {
      if (options == null || options.pk == null) {
        throw new Error('pk is required');
      }

      var _buildInsert = _this5.buildInsert(attributes);

      var _buildInsert2 = _slicedToArray(_buildInsert, 3);

      const names = _buildInsert2[0];
      const placeholders = _buildInsert2[1];
      const values = _buildInsert2[2];


      const sql = (0, _util.format)('INSERT INTO %s (%s)\nVALUES (%s) RETURNING %s;', table, names.join(', '), placeholders.join(', '), options.pk);

      const result = yield _this5.all(sql, values);

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
exports.default = Postgres;
//# sourceMappingURL=postgres.js.map