'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _minisqlite = require('minisqlite');

var _databaseCursor = require('./database-cursor');

var _databaseCursor2 = _interopRequireDefault(_databaseCursor);

var _databaseConnection = require('./database-connection');

var _databaseConnection2 = _interopRequireDefault(_databaseConnection);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _asyncToGenerator(fn) { return function () { var gen = fn.apply(this, arguments); return new Promise(function (resolve, reject) { function step(key, arg) { try { var info = gen[key](arg); var value = info.value; } catch (error) { reject(error); return; } if (info.done) { resolve(value); } else { return Promise.resolve(value).then(function (value) { step("next", value); }, function (err) { step("throw", err); }); } } return step("next"); }); }; }

class SQLiteConnection extends _databaseConnection2.default {
  static pool(connectionString) {
    return this._pool(_minisqlite.createPool, connectionString);
  }

  static connect(connectionString) {
    var _this = this;

    return _asyncToGenerator(function* () {
      return _this._connect(SQLiteConnection, connectionString);
    })();
  }

  query() {
    return new _databaseCursor2.default(this, this.rawClient.query(...arguments));
  }
}
exports.default = SQLiteConnection;
//# sourceMappingURL=sqlite-connection.js.map