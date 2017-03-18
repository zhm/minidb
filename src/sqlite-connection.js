import { createPool } from 'minisqlite';
import DatabaseCursor from './database-cursor';
import DatabaseConnection from './database-connection';

export default class SQLiteConnection extends DatabaseConnection {
  static pool(connectionString) {
    return this._pool(createPool, connectionString);
  }

  static async connect(connectionString) {
    return this._connect(SQLiteConnection, connectionString);
  }

  query(...args) {
    return new DatabaseCursor(this, this.rawClient.query(...args));
  }
}
