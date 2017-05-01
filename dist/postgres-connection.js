'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _databaseCursor = require('./database-cursor');

var _databaseCursor2 = _interopRequireDefault(_databaseCursor);

var _databaseConnection = require('./database-connection');

var _databaseConnection2 = _interopRequireDefault(_databaseConnection);

var _pg = require('pg');

var _pg2 = _interopRequireDefault(_pg);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _asyncToGenerator(fn) { return function () { var gen = fn.apply(this, arguments); return new Promise(function (resolve, reject) { function step(key, arg) { try { var info = gen[key](arg); var value = info.value; } catch (error) { reject(error); return; } if (info.done) { resolve(value); } else { return Promise.resolve(value).then(function (value) { step("next", value); }, function (err) { step("throw", err); }); } } return step("next"); }); }; }

let driver = null;

class PostgresConnection extends _databaseConnection2.default {
  static set driver(dr) {
    driver = dr;
  }

  static pool(connectionString) {
    return this._pool(driver.createPool, connectionString);
  }

  static connect(options) {
    var _this = this;

    return _asyncToGenerator(function* () {
      return _this._connect(PostgresConnection, options);
    })();
  }

  query() {
    return new _databaseCursor2.default(this, this.rawClient.query(...arguments), this.convert);
  }

  convert(_ref) {
    let column = _ref.column,
        value = _ref.value;

    return _pg2.default.types.getTypeParser(column.type)(value);
  }
}
exports.default = PostgresConnection;
//# sourceMappingURL=postgres-connection.js.map