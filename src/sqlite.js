import Promise from 'bluebird';
import sqlite from 'sqlite3';
import Database from './database';

export default class SQLite extends Database {
  async open() {
    // https://phabricator.babeljs.io/T2765
    const {file, mode} = this.options;

    const defaultMode = sqlite.OPEN_READWRITE | sqlite.OPEN_CREATE;

    const promise = new Promise((resolve, reject) => {
      const db = new sqlite.Database(file, mode != null ? mode : defaultMode, function (err) {
        if (err) {
          reject(err);
        } else {
          resolve(db);
        }
      });
    });

    this.db = await promise;

    if (this.options.wal) {
      await this.execute('PRAGMA journal_mode=WAL');
    }

    if (this.options.autoVacuum) {
      await this.execute('PRAGMA auto_vacuum=INCREMENTAL');
    }

    if (this.options.synchronous) {
      await this.execute('PRAGMA synchronous=' + this.options.synchronous.toUpperCase());
    }
  }

  async close() {
    const self = this;

    const promise = new Promise((resolve, reject) => {
      self.db.close(function (err) {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });

    await promise;

    this.db = null;
  }

  each(sql, params, callback) {
    const self = this;

    return new Promise((resolve, reject) => {
      let index = -1;
      let columns = null;

      const cb = function (err, row) {
        if (err) {
          return reject(err);
        }

        ++index;

        if (columns == null) {
          columns = Object.keys(row);
        }

        callback(columns, row, index);
      };

      const complete = function (err) {
        if (err) {
          return reject(err);
        } else {
          return resolve(null);
        }
      };

      let args = [sql].concat(params).concat(cb, complete);

      if (self.verbose) {
        console.log(sql, params);
      }

      self.db.each.apply(self.db, args);
    });
  }

  async execute(sql, params) {
    params = params || [];

    const self = this;

    return new Promise((resolve, reject) => {
      if (self.verbose) {
        console.log(sql, params);
      }

      self.db.run(sql, params, function (err) {
        if (err) {
          self.lastID = null;
          self.changes = null;

          if (self.verbose) {
            console.error('ERROR', err);
          }

          return reject(err);
        } else {
          self.lastID = this.lastID;
          self.changes = this.changes;

          return resolve(null);
        }
      });
    });
  }
}
