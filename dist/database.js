"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;

var _util = require("util");

var _esc = _interopRequireDefault(require("./esc"));

var _humanizeDuration = _interopRequireDefault(require("humanize-duration"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

const shortEnglishHumanizer = _humanizeDuration.default.humanizer({
  language: 'shortEn',
  languages: {
    shortEn: {
      ms: () => 'ms'
    }
  }
});

class Database {
  constructor(options) {
    this.options = options;
  }

  static setCustomType(typeName, definition) {
    if (definition) {
      Database.CUSTOM_TYPES[typeName] = definition;
    } else if (typeName) {
      delete Database.CUSTOM_TYPES[typeName];
    }
  }

  get verbose() {
    return false; // return true;
  }

  log(message) {// if (Database.debug) {
    //   console.warn('[SQL]', message);
    // }
  }

  static async measure(text, block) {
    if (!Database.debug) {
      return await block();
    }

    const start = new Date().getTime();
    let result = null;
    let error = null;

    try {
      result = await block();
    } catch (ex) {
      error = ex;
    }

    const total = new Date().getTime() - start;
    console.log('[SQL][' + shortEnglishHumanizer(total, {
      spacer: '',
      units: ['ms']
    }) + ']' + (error ? '[ERROR] ' : ' ') + text);

    if (error) {
      throw error;
    }

    return result;
  }

  ident(value) {
    return (0, _esc.default)(value, '`');
  }

  literal(value) {
    return (0, _esc.default)(value, "'");
  }

  async open() {
    return null;
  }

  async close() {
    return null;
  }

  async each(sql, params, callback) {
    return await Database.measure(sql, async () => {
      return await this._each(sql, params, callback);
    });
  }

  async execute(sql, params) {
    return await Database.measure(sql, async () => {
      return await this._execute(sql, params);
    });
  }

  beginTransaction() {
    return this.execute('BEGIN TRANSACTION;');
  }

  commit() {
    return this.execute('COMMIT TRANSACTION;');
  }

  rollback() {
    return this.execute('ROLLBACK TRANSACTION;');
  }

  async transaction(block) {
    await this.beginTransaction();

    try {
      await block(this);
      await this.commit();
    } catch (ex) {
      console.log('ERROR IN TRANSACTION', ex);
      await this.rollback();
      throw ex;
    }
  }

  async all(sql, params) {
    const rows = [];
    await this.each(sql, params, ({
      columns,
      values,
      index,
      cursor
    }) => {
      if (values) {
        rows.push(values);
      }
    });
    return rows;
  }

  async get(sql, params) {
    const rows = [];
    await this.each(sql, params, ({
      columns,
      values,
      index,
      cursor
    }) => {
      if (values) {
        rows.push(values);
      }
    });
    return rows.length ? rows[0] : null;
  }

  buildWhere(where) {
    const clause = [];
    const values = [];

    if (where) {
      for (const key of Object.keys(where)) {
        const value = where[key];

        if (value != null) {
          clause.push(this.ident(key) + ' = ?');
          values.push(value);
        } else {
          clause.push(this.ident(key) + ' IS NULL');
        }
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

  findEachByAttributes(options, callback) {
    const statement = this.findStatement(options.tableName, options.columns, options.where, options.orderBy, options.limit, options.offset);
    return this.each(statement.sql, statement.values, callback);
  }

  findAllByAttributes(tableName, columns, where, orderBy, limit, offset) {
    const statement = this.findStatement(tableName, columns, where, orderBy, limit, offset);
    return this.all(statement.sql, statement.values);
  }

  async findFirstByAttributes(tableName, columns, attributes, orderBy) {
    const rows = await this.findAllByAttributes(tableName, columns, attributes, orderBy, 1);
    return rows != null ? rows[0] : null;
  }

  trace() {
    return null;
  }

  profile(sql, time) {
    console.log('PROFILE', '(' + time + 'ms)', sql);
  }

  findStatement(tableName, columns, where, orderBy, limit, offset) {
    const selection = columns == null ? ['*'] : columns;
    const [clause, values] = this.buildWhere(where);
    const parts = [];

    if (clause.length > 0) {
      parts.push((0, _util.format)(' WHERE %s', clause.join(' AND ')));
    }

    if (orderBy != null) {
      parts.push((0, _util.format)(' ORDER BY %s', orderBy));
    }

    if (limit != null) {
      parts.push((0, _util.format)(' LIMIT %s', this.literal(limit)));
    }

    if (offset != null) {
      parts.push((0, _util.format)(' OFFSET %s', this.literal(offset)));
    }

    const sql = (0, _util.format)('SELECT %s FROM %s%s', selection.join(', '), this.ident(tableName), parts.join(''));
    return {
      sql,
      values
    };
  }

  insertStatement(table, attributes) {
    const [names, placeholders, values] = this.buildInsert(attributes);
    const sql = (0, _util.format)('INSERT INTO %s (%s)\nVALUES (%s);', table, names.join(', '), placeholders.join(', '));
    return {
      sql,
      values
    };
  }

  updateStatement(table, where, attributes, options) {
    const values = [];
    const [sets, updateValues] = this.buildUpdate(attributes);
    values.push.apply(values, updateValues);

    if (options && options.raw) {
      for (const name of Object.keys(options.raw)) {
        sets.push((0, _util.format)('%s = %s', name, options.raw[name]));
      }
    }

    const [clause, whereValues] = this.buildWhere(where);
    values.push.apply(values, whereValues);
    const whereClause = clause.length ? ' WHERE ' + clause.join(' AND ') : '';
    const sql = (0, _util.format)('UPDATE %s SET %s%s;', table, sets.join(', '), whereClause);
    return {
      sql,
      values
    };
  }

  deleteStatement(table, where) {
    const [clause, values] = this.buildWhere(where);
    const whereClause = clause.length ? ' WHERE ' + clause.join(' AND ') : '';
    const sql = (0, _util.format)('DELETE FROM %s%s;', table, whereClause);
    return {
      sql,
      values
    };
  }

  async insert(table, attributes, options) {
    const statement = this.insertStatement(table, attributes);
    await this.execute(statement.sql, statement.values);
    return this.lastID;
  }

  async update(table, where, attributes, options) {
    const statement = this.updateStatement(table, where, attributes, options);
    await this.execute(statement.sql, statement.values);
    return null;
  }

  async delete(table, where, options) {
    const statement = this.deleteStatement(table, where);
    await this.execute(statement.sql, statement.values);
    return null;
  }

  toDatabase(value, column) {
    if (value == null) {
      return null;
    }

    if (Database.CUSTOM_TYPES[column.type]) {
      return Database.CUSTOM_TYPES[column.type].toDatabase(value, column);
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

    if (Database.CUSTOM_TYPES[column.type]) {
      return Database.CUSTOM_TYPES[column.type].fromDatabase(value, column);
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

exports.default = Database;

_defineProperty(Database, "CUSTOM_TYPES", {});
//# sourceMappingURL=database.js.map