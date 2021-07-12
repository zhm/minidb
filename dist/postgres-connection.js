"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;

var _databaseCursor = _interopRequireDefault(require("./database-cursor"));

var _databaseConnection = _interopRequireDefault(require("./database-connection"));

var _pg = _interopRequireDefault(require("pg"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

let driver = null;

class PostgresConnection extends _databaseConnection.default {
  static set driver(dr) {
    driver = dr;
  }

  static pool(connectionString) {
    return this._pool(driver.createPool, connectionString, PostgresConnection.poolOptions);
  }

  static async connect(options) {
    return this._connect(PostgresConnection, options);
  }

  query(...args) {
    return new _databaseCursor.default(this, this.rawClient.query(...args), this.convert);
  }

  convert({
    column,
    value
  }) {
    return _pg.default.types.getTypeParser(column.type)(value);
  }

}

exports.default = PostgresConnection;
//# sourceMappingURL=postgres-connection.js.map