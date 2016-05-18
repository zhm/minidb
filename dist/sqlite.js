'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _bluebird = require('bluebird');

var _bluebird2 = _interopRequireDefault(_bluebird);

var _sqlite = require('sqlite3');

var _sqlite2 = _interopRequireDefault(_sqlite);

var _database = require('./database');

var _database2 = _interopRequireDefault(_database);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _asyncToGenerator(fn) { return function () { var gen = fn.apply(this, arguments); return new _bluebird2.default(function (resolve, reject) { function step(key, arg) { try { var info = gen[key](arg); var value = info.value; } catch (error) { reject(error); return; } if (info.done) { resolve(value); } else { return _bluebird2.default.resolve(value).then(function (value) { return step("next", value); }, function (err) { return step("throw", err); }); } } return step("next"); }); }; }

class SQLite extends _database2.default {
  get dialect() {
    return 'sqlite';
  }

  open() {
    var _this = this;

    return _asyncToGenerator(function* () {
      // https://phabricator.babeljs.io/T2765
      var _options = _this.options;
      const file = _options.file;
      const mode = _options.mode;


      const defaultMode = _sqlite2.default.OPEN_READWRITE | _sqlite2.default.OPEN_CREATE;

      const promise = new _bluebird2.default(function (resolve, reject) {
        const db = new _sqlite2.default.Database(file, mode != null ? mode : defaultMode, function (err) {
          if (err) {
            reject(err);
          } else {
            resolve(db);
          }
        });
      });

      _this.db = yield promise;

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

  close() {
    var _this2 = this;

    return _asyncToGenerator(function* () {
      const promise = new _bluebird2.default(function (resolve, reject) {
        _this2.db.close(function (err) {
          if (err) {
            reject(err);
          } else {
            resolve();
          }
        });
      });

      yield promise;

      _this2.db = null;
    })();
  }

  each(sql, params, callback) {
    return new _bluebird2.default((resolve, reject) => {
      let index = -1;
      let columns = null;

      const cb = (err, row) => {
        if (err) {
          return reject(err);
        }

        ++index;

        if (columns == null) {
          columns = Object.keys(row);
        }

        return callback(columns, row, index);
      };

      const complete = err => {
        if (err) {
          return reject(err);
        }

        return resolve(null);
      };

      const args = [sql].concat(params).concat(cb, complete);

      if (this.verbose) {
        console.log(sql, params);
      }

      this.db.each.apply(this.db, args);
    });
  }

  execute(sql, options) {
    var _this3 = this;

    return _asyncToGenerator(function* () {
      const params = options || [];

      return new _bluebird2.default(function (resolve, reject) {
        if (_this3.verbose) {
          console.log(sql, params);
        }

        /* eslint-disable consistent-this */
        const self = _this3;
        /* eslint-enable consistent-this */

        _this3.db.run(sql, params, function handler(err) {
          if (err) {
            self.lastID = null;
            self.changes = null;

            if (self.verbose) {
              console.error('ERROR', err);
            }

            return reject(err);
          }

          self.lastID = this.lastID;
          self.changes = this.changes;

          return resolve(null);
        });
      });
    })();
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