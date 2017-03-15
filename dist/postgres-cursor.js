'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _pg = require('pg');

var _pg2 = _interopRequireDefault(_pg);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _asyncToGenerator(fn) { return function () { var gen = fn.apply(this, arguments); return new Promise(function (resolve, reject) { function step(key, arg) { try { var info = gen[key](arg); var value = info.value; } catch (error) { reject(error); return; } if (info.done) { resolve(value); } else { return Promise.resolve(value).then(function (value) { step("next", value); }, function (err) { step("throw", err); }); } } return step("next"); }); }; }

class PostgresCursor {
  constructor(connection, rawCursor) {
    this._connection = connection;
    this._rawCursor = rawCursor;
    this._finished = false;
  }

  get connection() {
    return this._connection;
  }

  parseValues(columns, values) {
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

    return parsedValues;
  }

  get hasRows() {
    return !this._finished;
  }

  next() {
    var _this = this;

    return _asyncToGenerator(function* () {
      return new Promise(function (resolve, reject) {
        _this._rawCursor.next(function (err, finished, columns, values, index) {
          _this._finished = finished;

          if (err) {
            return reject(err);
          } else if (finished) {
            return resolve(null);
          }

          return resolve({ columns: columns,
            values: columns && _this.parseValues(columns, values),
            index: index });
        });
      });
    })();
  }

  close() {
    var _this2 = this;

    return _asyncToGenerator(function* () {
      // exhaust the cursor to completion
      while (!_this2._rawCursor.finished) {
        yield _this2.next();
      }
    })();
  }
}
exports.default = PostgresCursor;
//# sourceMappingURL=postgres-cursor.js.map