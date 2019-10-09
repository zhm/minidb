import DatabaseCursor from './database-cursor';
import DatabaseConnection from './database-connection';
import pg from 'pg';

let driver = null;

export default class PostgresConnection extends DatabaseConnection {
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
    return new DatabaseCursor(this, this.rawClient.query(...args), this.convert);
  }

  convert({column, value}) {
    return pg.types.getTypeParser(column.type)(value);
  }
}
