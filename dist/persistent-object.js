"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;

var _util = require("util");

var _mixmatch = _interopRequireDefault(require("mixmatch"));

var _assert = _interopRequireDefault(require("assert"));

var _database = _interopRequireDefault(require("./database"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

const models = [];

function checkDatabase(db) {
  (0, _assert.default)(db instanceof _database.default, 'invalid db');
}

class PersistentObject extends _mixmatch.default {
  constructor(db, attributes) {
    super();
    this.initializePersistentObject(db, attributes);
  }

  get db() {
    return this._db;
  }

  get rowID() {
    return this._rowID;
  }

  initializePersistentObject(db, attributes) {
    this._db = db;
    this.updateFromDatabaseAttributes(attributes || {}, db);
    return this;
  }

  static async findFirstColumns(ModelClass, db, attributes, columns) {
    return await db.findFirstByAttributes(ModelClass.tableName, columns, attributes);
  }

  static async findFirst(ModelClass, db, attributes) {
    const row = await db.findFirstByAttributes(ModelClass.tableName, null, attributes);

    if (row) {
      const instance = new ModelClass();
      instance.initializePersistentObject(db, row);
      return instance;
    }

    return null;
  }

  static async findAllColumns(ModelClass, db, attributes, columns) {
    return await db.findAllByAttributes(ModelClass.tableName, columns, attributes);
  }

  static async findAllBySQL(ModelClass, db, sql, values) {
    const rows = await db.all(sql, values);
    return rows.map(row => {
      const instance = new ModelClass();
      instance.initializePersistentObject(db, row);
      return instance;
    });
  }

  static async findAll(ModelClass, db, attributes, orderBy) {
    const rows = await db.findAllByAttributes(ModelClass.tableName, null, attributes, orderBy);
    return rows.map(row => {
      const instance = new ModelClass();
      instance.initializePersistentObject(db, row);
      return instance;
    });
  }

  static findEachBySQL(ModelClass, db, sql, params, callback) {
    return db.each(sql, params, async ({
      columns,
      values,
      index
    }) => {
      if (values) {
        const instance = new ModelClass();
        instance.initializePersistentObject(db, values);
        return await callback(instance, {
          columns,
          values,
          index
        });
      }

      return null;
    });
  }

  static findEach(ModelClass, db, options, callback) {
    return db.findEachByAttributes({
      tableName: ModelClass.tableName,
      ...options
    }, async ({
      columns,
      values,
      index
    }) => {
      if (values) {
        const instance = new ModelClass();
        instance.initializePersistentObject(db, values);
        return await callback(instance, {
          columns,
          values,
          index
        });
      }

      return null;
    });
  }

  static async findOrCreate(ModelClass, db, attributes) {
    const row = await db.findFirstByAttributes(ModelClass.tableName, null, attributes);
    const instance = new ModelClass();
    instance.initializePersistentObject(db, { ...row,
      ...attributes
    });
    return instance;
  }

  static create(ModelClass, db, attributes) {
    const instance = new ModelClass();
    instance.initializePersistentObject(db, attributes);
    return instance;
  }

  static async count(ModelClass, db, attributes) {
    const result = await db.findFirstByAttributes(ModelClass.tableName, ['COUNT(1) AS count'], attributes);
    return result.count;
  }

  static get modelMethods() {
    return ['findFirst', 'findFirstColumns', 'findAll', 'findAllBySQL', 'findAllColumns', 'findEach', 'findEachBySQL', 'findOrCreate', 'create', 'count'];
  }

  static get models() {
    return models.slice();
  }

  static register(modelClass) {
    models.push(modelClass);
    PersistentObject.includeInto(modelClass);

    const wrap = method => {
      return (...params) => {
        const args = [modelClass].concat(params);
        return PersistentObject[method].apply(PersistentObject, args);
      };
    };

    for (const method of PersistentObject.modelMethods) {
      modelClass[method] = wrap(method);
    }

    for (const column of modelClass.columns) {
      if (column.simple) {
        const varName = '_' + column.name;
        const customType = _database.default.CUSTOM_TYPES[column.type];
        const customGetter = customType && customType.getter ? customType.getter({
          varName,
          column
        }) : null;
        const customSetter = customType && customType.setter ? customType.setter({
          varName,
          column
        }) : null;
        Object.defineProperty(modelClass.prototype, column.name, {
          get: customGetter || function getter() {
            return this[varName];
          },
          set: customSetter || function setter(value) {
            this[varName] = value;
          },
          enumerable: true,
          configurable: true
        });
      }
    }
  }

  assignAttributes(attributes) {
    this._assignAttributes(attributes);
  }

  _assignAttributes(attributes) {
    for (const key of Object.keys(attributes)) {
      const column = this.columnsByAttributeName[key];

      if (column) {
        if (column.simple) {
          // use the setter
          this[column.name] = attributes[column.name];
        } else {
          this['_' + column.name] = attributes[column.name];
        }
      }
    }
  }

  _buildColumns() {
    const byColumnName = this.constructor._columnsByColumnName = {};
    const byAttributeName = this.constructor._columnsByAttributeName = {};

    for (const column of this.constructor.columns) {
      byColumnName[column.column] = column;
      byAttributeName[column.name] = column;
    }
  }

  get columnsByColumnName() {
    if (!this.constructor._columnsByColumnName) {
      this._buildColumns();
    }

    return this.constructor._columnsByColumnName;
  }

  get columnsByAttributeName() {
    if (!this.constructor._columnsByAttributeName) {
      this._buildColumns();
    }

    return this.constructor._columnsByAttributeName;
  }

  updateFromDatabaseAttributes(attributes, db) {
    this._updateFromDatabaseAttributes(attributes, db || this.db);
  }

  _updateFromDatabaseAttributes(attributes, db) {
    db = db || this.db;
    checkDatabase(db);

    for (const key of Object.keys(attributes)) {
      const column = this.columnsByColumnName[key];
      const value = column && db.fromDatabase(attributes[column.column], column);

      if (column && column.simple) {
        // call the setter
        this[column.name] = value;
      } else if (column) {
        this['_' + column.name] = value;
      } else if (key !== 'id' && key !== 'created_at' && key !== 'updated_at') {// throw new Error(format("column definition for '%s' does not exist", key));
      }
    }

    this.objectCreatedAt = db.fromDatabase(attributes.created_at, {
      type: 'datetime'
    });
    this.objectUpdatedAt = db.fromDatabase(attributes.updated_at, {
      type: 'datetime'
    });
    this._rowID = this.toNumber(attributes.id);
  }

  attributes() {
    const values = {};

    for (const column of this.constructor.columns) {
      const name = column.name;
      values['_' + name] = this['_' + name];
    }

    return values;
  }

  databaseValues(db) {
    db = db || this.db;
    checkDatabase(db);
    const values = {};

    for (const column of this.constructor.columns) {
      const name = column.name;
      const value = this['_' + name]; // TODO(zhm) this doesn't work with the id attribute
      // if (value == null && column.null === false) {
      //   throw Error(format('column %s cannot be null', name));
      // }

      values[column.column] = db.toDatabase(value, column);
    }

    return values;
  }

  toNumber(integer) {
    return integer != null ? +integer : null;
  }

  updateTimestamps() {
    const now = new Date();

    if (!this.objectCreatedAt) {
      this.objectCreatedAt = now;
    }

    this.objectUpdatedAt = now;
  }

  get objectCreatedAt() {
    return this._objectCreatedAt;
  }

  get objectUpdatedAt() {
    return this._objectUpdatedAt;
  }

  set objectCreatedAt(date) {
    this._objectCreatedAt = date;
  }

  set objectUpdatedAt(date) {
    this._objectUpdatedAt = date;
  }

  get isPersisted() {
    return this.rowID > 0;
  }

  async save({
    db,
    timestamps,
    ...rest
  } = {}) {
    db = db || this.db;
    checkDatabase(db);

    if (this.beforeSave) {
      const result = await this.beforeSave({
        db,
        timestamps,
        ...rest
      });

      if (result === false) {
        return this;
      }
    }

    if (timestamps !== false) {
      this.updateTimestamps();
    }

    const values = this.databaseValues(db);
    values.created_at = db.toDatabase(this.objectCreatedAt, {
      type: 'datetime'
    });
    values.updated_at = db.toDatabase(this.objectUpdatedAt, {
      type: 'datetime'
    });

    if (!this.isPersisted) {
      this._rowID = await db.insert(this.constructor.tableName, values, {
        pk: 'id'
      });
    } else {
      await db.update(this.constructor.tableName, {
        id: this.rowID
      }, values);
    }

    if (this.afterSave) {
      await this.afterSave({
        db,
        timestamps,
        ...rest
      });
    }

    return this;
  }

  async delete({
    db,
    ...rest
  } = {}) {
    db = db || this.db;
    checkDatabase(db);

    if (this.isPersisted) {
      if (this.beforeDelete) {
        const result = await this.beforeDelete({
          db,
          ...rest
        });

        if (result === false) {
          return this;
        }
      }

      await db.delete(this.constructor.tableName, {
        id: this.rowID
      });

      if (this.afterDelete) {
        await this.afterDelete({
          db,
          ...rest
        });
      }

      this._rowID = null;
      this.objectCreatedAt = null;
      this.objectUpdatedAt = null;
    }

    return this;
  }

  async loadOne(name, model, id, db) {
    db = db || this.db;
    checkDatabase(db);
    const ivar = '_' + name;
    const pk = id || this[ivar + 'RowID'];

    if (pk == null) {
      return null;
    }

    if (this[ivar]) {
      return this[ivar];
    }

    const instance = await model.findFirst(db, {
      id: pk
    });
    this.setOne(name, instance);
    return this[ivar];
  }

  setOne(name, instance) {
    const ivar = '_' + name;

    if (instance) {
      this[ivar] = instance;
      this[ivar + 'ID'] = instance.id;
      this[ivar + 'RowID'] = instance.rowID;
    } else {
      this[ivar] = null;
      this[ivar + 'ID'] = null;
      this[ivar + 'RowID'] = null;
    }
  }

}

exports.default = PersistentObject;
//# sourceMappingURL=persistent-object.js.map