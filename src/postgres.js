import Promise from 'bluebird';
import connection from './postgres-connection';
import pg from 'pg';
import pgformat from 'pg-format';
import {format} from 'util';
import esc from './esc';
import Database from './database';

// Parse bigints as `Number` objects. If a caller *really* knows their
// number cannot fit in a JS Number, it can be casted to `text` in
// the query and parsed manually. Without this, dead simple COUNT(*)
// queries are returned as text and it makes doing simple things hard.
pg.types.setTypeParser(20, function (val) {
  return val == null ? null : parseInt(val, 10);
});

export default class Postgres extends Database {
  ident(value) {
    return esc(value, '"');
  }

  static async connect(db) {
    return await connection(db);
  }

  async each(sql, params, callback) {
    const self = this;

    const exec = function (client) {
      return new Promise((resolve, reject) => {
        client.rawClient.query(sql).each(function (err, finished, columns, values, index) {
          if (err) {
            return reject(err);
          } else if (finished) {
            return resolve(null);
          }

          if (!callback) {
            return null;
          }

          let parsedValues = null;

          if (values) {
            ++index;

            parsedValues = {};

            for (let i = 0; i < columns.length; ++i) {
              let value = values[i];

              if (value != null) {
                value = pg.types.getTypeParser(columns[i].type)(value);
              }

              parsedValues[columns[i].name] = value;
            }
          }

          callback(columns, parsedValues, index);
        });
      });
    };

    const client = await Postgres.connect(this.options.db);

    try {
      await exec(client);
    } catch (ex) {
      if (self.verbose) {
        console.error('ERROR', ex);
      }

      await client.done();

      throw ex;
    }

    await client.done();
  }

  async execute(sql, params) {
    await this.each(sql, [], null);
  }

  buildWhere(where) {
    const clause = [];

    if (where) {
      for (const key of Object.keys(where)) {
        clause.push(pgformat('%I = %L', key, where[key]));
      }
    }

    return [clause, []];
  }

  buildInsert(attributes) {
    const names = [];
    const values = [];
    const placeholders = [];

    // Use the literal values instead of placeholders  because parameterized
    // queries require prepared statements. Prepared statements are stateful
    // and impose requirements on the connection that are incompatible with
    // pgbouncer.
    for (const key of Object.keys(attributes)) {
      names.push(pgformat('%I', key));
      placeholders.push(pgformat('%L', attributes[key]));
    }

    return [names, placeholders, values];
  }

  buildUpdate(attributes) {
    const sets = [];
    const values = [];

    for (const key of Object.keys(attributes)) {
      sets.push(pgformat('%I = %L', key, attributes[key]));
    }

    return [sets, values];
  }

  async insert(table, attributes, options) {
    if (options == null || options.pk == null) {
      throw new Error('pk is required');
    }

    const [names, placeholders, values] = this.buildInsert(attributes);

    const sql = format('INSERT INTO %s (%s)\nVALUES (%s) RETURNING %s;',
                       table,
                       names.join(', '),
                       placeholders.join(', '),
                       options.pk);

    const result = await this.all(sql, values);

    return +result[0].id;
  }

  toDatabase(value, column) {
    if (value == null) {
      return null;
    }

    switch (column.type) {
      case 'datetime':
        return value.toISOString();

      default:
        return super.toDatabase(value, column);
    }
  }

  fromDatabase(value, column) {
    if (value == null) {
      return null;
    }

    switch (column.type) {
      case 'datetime':
        return new Date(value);

      default:
        return super.fromDatabase(value, column);
    }
  }
}
