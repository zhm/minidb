import { createPool } from 'minipg';
import DatabaseCursor from './database-cursor';
import DatabaseConnection from './database-connection';
import pg from 'pg';

export default class PostgresConnection extends DatabaseConnection {
  static pool(connectionString) {
    return this._pool(createPool, connectionString);
  }

  static async connect(connectionString) {
    return this._connect(PostgresConnection, connectionString);
  }

  query(...args) {
    return new DatabaseCursor(this, this.rawClient.query(...args), this.convert);
  }

  convert({column, value}) {
    return pg.types.getTypeParser(column.type)(value);
  }
}
