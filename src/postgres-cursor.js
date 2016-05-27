import pg from 'pg';

export default class PostgresCursor {
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
          value = pg.types.getTypeParser(columns[i].type)(value);
        }

        parsedValues[columns[i].name] = value;
      }
    }

    return parsedValues;
  }

  get hasRows() {
    return !this._finished;
  }

  async next() {
    return new Promise((resolve, reject) => {
      this._rawCursor.next((err, finished, columns, values, index) => {
        this._finished = finished;

        if (err) {
          return reject(err);
        } else if (finished) {
          return resolve(null);
        }

        return resolve({columns: columns,
                        values: columns && this.parseValues(columns, values),
                        index: index});
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
