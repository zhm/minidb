import {format} from 'util';
import esc from './esc';

export default class Database {
  constructor(options) {
    this.options = options;
  }

  get verbose() {
    return false;
    // return true;
  }

  ident(value) {
    return esc(value, '`');
  }

  literal(value) {
    return esc(value, "'");
  }

  async open() {
  }

  async close() {
  }

  async each(sql, params, callback) {
  }

  async execute(sql, params) {
  }

  beginTransaction() {
    return this.execute('BEGIN TRANSACTION');
  }

  commit() {
    return this.execute('COMMIT TRANSACTION');
  }

  rollback() {
    return this.execute('ROLLBACK TRANSACTION');
  }

  async transaction(block) {
    await this.beginTransaction();

    try {
      await block();

      await this.commit();
    } catch (ex) {
      console.log('ERROR IN TRANSACTION', ex);
      await this.rollback();
      throw ex;
    }
  }

  async all(sql, params) {
    const rows = [];
    const self = this;

    await self.each(sql, params, (columns, row, index) => {
      if (row) {
        rows.push(row);
      }
    });

    return rows;
  }

  async get(sql, params) {
    const rows = [];

    await this.each(sql, params, (columns, row, index) => {
      if (row) {
        rows.push(row);
      }
    });

    return (rows.length ? rows[0] : null);
  }

  buildWhere(where) {
    const clause = [];
    const values = [];

    if (where) {
      for (const key of Object.keys(where)) {
        clause.push(this.ident(key) + ' = ?');
        values.push(where[key]);
      }
    }

    return [clause, values];
  }

  buildInsert(attributes) {
    const names = [];
    const values = [];
    const placeholders = [];

    for (const key of Object.keys(attributes)) {
      names.push(this.ident(key));
      placeholders.push('?');

      const value = attributes[key];

      if (Array.isArray(value)) {
        values.push('\t' + value.join('\t') + '\t');
      } else {
        values.push(value);
      }
    }

    return [names, placeholders, values];
  }

  buildUpdate(attributes) {
    const sets = [];
    const values = [];

    for (const name of Object.keys(attributes)) {
      sets.push(this.ident(name) + ' = ?');

      const value = attributes[name];

      if (Array.isArray(value)) {
        values.push('\t' + value.join('\t') + '\t');
      } else {
        values.push(value);
      }
    }

    return [sets, values];
  }

  findAllByAttributes(tableName, columns, where, orderBy, limit, offset) {
    const selection = (columns == null ? ['*'] : columns);

    const [clause, values] = this.buildWhere(where);

    let parts = [];

    if (clause.length > 0) {
      parts.push(format(' WHERE %s', clause.join(' AND ')));
    }

    if (orderBy != null) {
      parts.push(format(' ORDER BY %s', orderBy));
    }

    if (limit != null) {
      parts.push(format(' LIMIT %s', this.literal(limit)));
    }

    if (offset != null) {
      parts.push(format(' OFFSET %s', this.literal(offset)));
    }

    const sql = format('SELECT %s FROM %s%s',
                       selection.join(', '),
                       this.ident(tableName),
                       parts.join(''));

    return this.all(sql, values);
  }

  async findFirstByAttributes(tableName, columns, attributes, orderBy) {
    const rows = await this.findAllByAttributes(tableName, columns, attributes, orderBy, 1);

    return rows != null ? rows[0] : null;
  }

  trace() {
  }

  profile(sql, time) {
    console.log('PROFILE', '(' + time + 'ms)', sql);
  }

  async insert(table, attributes, options) {
    const [names, placeholders, values] = this.buildInsert(attributes);

    const sql = format('INSERT INTO %s (%s)\nVALUES (%s);',
                       table,
                       names.join(', '),
                       placeholders.join(', '));

    await this.execute(sql, values);

    return this.lastID;
  }

  async update(table, where, attributes, options) {
    const values = [];

    const [sets, updateValues] = this.buildUpdate(attributes);

    values.push.apply(values, updateValues);

    if (options && options.raw) {
      for (const name of Object.keys(options.raw)) {
        sets.push(format('%s = %s', name, options.raw[name]));
      }
    }

    const [clause, whereValues] = this.buildWhere(where);

    values.push.apply(values, whereValues);

    const whereClause = clause.length ? ' WHERE ' + clause.join(' AND ') : '';

    const sql = format('UPDATE %s SET %s%s',
                       table, sets.join(', '), whereClause);

    await this.execute(sql, values);

    return null;
  }

  async delete(table, where, options) {
    const [clause, values] = this.buildWhere(where);

    const whereClause = clause.length ? ' WHERE ' + clause.join(' AND ') : '';

    const sql = format('DELETE FROM %s%s',
                       table, whereClause);

    await this.execute(sql, values);

    return null;
  }

  toDatabase(value, column) {
    if (value == null) {
      return null;
    }

    switch (column.type) {
      case 'string':
        return value.toString();

      case 'integer':
        return +value;

      case 'double':
        return +value;

      case 'boolean':
        return !!value;

      case 'datetime':
        return value;

      case 'json':
        return JSON.stringify(value);

      default:
        return value.toString();
    }
  }

  fromDatabase(value, column) {
    if (value == null) {
      return null;
    }

    switch (column.type) {
      case 'string':
        return value.toString();

      case 'integer':
        return +value;

      case 'double':
        return +value;

      case 'boolean':
        return !!value;

      case 'datetime':
        return new Date(+value);

      case 'json':
        return JSON.parse(value);

      default:
        return value.toString();
    }
  }
}
