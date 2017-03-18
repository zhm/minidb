import {format} from 'util';
import Mixin from 'mixmatch';
import assert from 'assert';
import Database from './database';

const models = [];

function checkDatabase(db) {
  assert(db instanceof Database, 'invalid db');
}

export default class PersistentObject extends Mixin {
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

  static async findAll(ModelClass, db, attributes, orderBy) {
    const rows = await db.findAllByAttributes(ModelClass.tableName, null, attributes, orderBy);

    return rows.map((row) => {
      const instance = new ModelClass();

      instance.initializePersistentObject(db, row);

      return instance;
    });
  }

  static findEach(ModelClass, db, options, callback) {
    return db.findEachByAttributes({tableName: ModelClass.tableName, ...options}, async (columns, row, index) => {
      if (row) {
        const instance = new ModelClass();

        instance.initializePersistentObject(db, row);

        return await callback(instance, index, row, columns);
      }

      return null;
    });
  }

  static async findOrCreate(ModelClass, db, attributes) {
    const row = await db.findFirstByAttributes(ModelClass.tableName, null, attributes);

    const instance = new ModelClass();

    instance.initializePersistentObject(db, row || attributes);

    return instance;
  }

  static create(ModelClass, db, attributes) {
    const instance = new ModelClass();

    instance.initializePersistentObject(db, attributes);

    return instance;
  }

  static async count(ModelClass, db, attributes) {
    const result = await db.findFirstByAttributes(ModelClass.tableName, [ 'COUNT(1) AS count' ], attributes);

    return result.count;
  }

  static get modelMethods() {
    return [ 'findFirst', 'findFirstColumns', 'findAll', 'findAllColumns', 'findEach', 'findOrCreate', 'create', 'count' ];
  }

  static get models() {
    return models.slice();
  }

  static register(modelClass) {
    models.push(modelClass);

    PersistentObject.includeInto(modelClass);

    const wrap = (method) => {
      return (...params) => {
        const args = [ modelClass ].concat(params);
        return PersistentObject[method].apply(PersistentObject, args);
      };
    };

    for (const method of PersistentObject.modelMethods) {
      modelClass[method] = wrap(method);
    }
  }

  assignAttributes(attributes) {
    this._assignAttributes(attributes);
  }

  _assignAttributes(attributes) {
    for (const key of Object.keys(attributes)) {
      const column = this.columnsByColumnName[key];

      if (column) {
        this['_' + column.name] = attributes[column.column];
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

    for (const column of this.constructor.columns) {
      const name = '_' + column.name;
      const value = attributes[column.column];

      // if (value == null && column[2] && column[2].null === false) {
      //   console.warn(format('column %s cannot be null', name));
      // }

      this[name] = db.fromDatabase(value, column);
    }

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
      const value = this['_' + name];

      // TODO(zhm) this doesn't work with the id attribute
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

    if (!this.createdAt) {
      this.createdAt = now;
    }

    this.updatedAt = now;
  }

  get isPersisted() {
    return this.rowID > 0;
  }

  async save({db, timestamps, ...rest} = {}) {
    db = db || this.db;

    checkDatabase(db);

    if (this.beforeSave) {
      const result = await this.beforeSave({db, timestamps, ...rest});

      if (result === false) {
        return this;
      }
    }

    if (timestamps !== false) {
      this.updateTimestamps();
    }

    const values = this.databaseValues(db);

    values.created_at = db.toDatabase(this.createdAt, {type: 'datetime'});
    values.updated_at = db.toDatabase(this.updatedAt, {type: 'datetime'});

    if (!this.isPersisted) {
      this._rowID = await db.insert(this.constructor.tableName, values, {pk: 'id'});
    } else {
      await db.update(this.constructor.tableName, {id: this.rowID}, values);
    }

    // It's not possible to override `async` methods currently (and be able to use `super`)
    if (this.afterSave) {
      await this.afterSave({db, timestamps, ...rest});
    }

    return this;
  }

  async delete({db} = {}) {
    db = db || this.db;

    checkDatabase(db);

    if (this.isPersisted) {
      await db.delete(this.constructor.tableName, {id: this.rowID});

      this._rowID = null;
      this.createdAt = null;
      this.updatedAt = null;
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

    const instance = await model.findFirst(db, {id: pk});

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
