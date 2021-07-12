"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;

class DatabaseCursor {
  constructor(connection, rawCursor, converter) {
    this._connection = connection;
    this._rawCursor = rawCursor;
    this._converter = converter;
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
        const column = columns[i];

        if (value != null && this._converter) {
          value = this._converter({
            column,
            value
          });
        }

        parsedValues[column.name] = value;
      }
    }

    return parsedValues;
  }

  get hasRows() {
    return !this._finished;
  }

  async next() {
    return new Promise((resolve, reject) => {
      this._rawCursor.next((err, {
        finished,
        columns,
        values,
        index,
        client
      }) => {
        this._finished = finished;

        if (err) {
          return reject(err);
        } else if (finished) {
          return resolve(null);
        }

        return resolve({
          columns: columns,
          values: columns && this.parseValues(columns, values),
          index: index,
          client
        });
      });
    });
  }

  async close() {
    // exhaust the cursor to completion
    while (!this._rawCursor.finished) {
      await this.next();
    }
  }

}

exports.default = DatabaseCursor;
//# sourceMappingURL=database-cursor.js.map