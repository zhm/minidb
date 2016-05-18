import {format} from 'util';
import Mixin from 'mixmatch';

const models = [];

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
    this.updateFromDatabaseAttributes(attributes || {});

    return this;
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

  static async findAll(ModelClass, db, attributes, orderBy) {
    const rows = await db.findAllByAttributes(ModelClass.tableName, null, attributes, orderBy);

    return rows.map((row) => {
      const instance = new ModelClass();

      instance.initializePersistentObject(db, row);

      return instance;
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
    return [ 'findFirst', 'findAll', 'findOrCreate', 'create', 'count' ];
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

  updateFromDatabaseAttributes(attributes) {
    this._updateFromDatabaseAttributes(attributes);
  }

  _updateFromDatabaseAttributes(attributes) {
    for (const column of this.constructor.columns) {
      const name = '_' + column.name;
      const value = attributes[column.column];

      // if (value == null && column[2] && column[2].null === false) {
      //   console.warn(format('column %s cannot be null', name));
      // }

      this[name] = this.db.fromDatabase(value, column);
    }

    this._rowID = this.toNumber(attributes.id);
  }

  get databaseValues() {
    const values = {};

    for (const column of this.constructor.columns) {
      const name = column.name;
      const value = this['_' + name];

      if (value == null && column.null === false) {
        throw Error(format('column %s cannot be null', name));
      }

      values[column.column] = this.db.toDatabase(value, column);
    }

    return values;
  }

  get changes() {
    return this.databaseValues;
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

  async save(opts) {
    const options = opts || {};

    if (this.beforeSave) {
      await this.beforeSave(options);
    }

    const values = this.databaseValues;

    if (options.timestamps !== false) {
      this.updateTimestamps();
    }

    values.created_at = this.db.toDatabase(this.createdAt, {type: 'datetime'});
    values.updated_at = this.db.toDatabase(this.updatedAt, {type: 'datetime'});

    if (!this.isPersisted) {
      this._rowID = await this.db.insert(this.constructor.tableName, values, {pk: 'id'});
    } else {
      await this.db.update(this.constructor.tableName, {id: this.rowID}, values);
    }

    // It's not possible to override `async` methods currently (and be able to use `super`)
    if (this.afterSave) {
      await this.afterSave(options);
    }

    return this;
  }

  async delete(opts) {
    if (this.isPersisted) {
      await this.db.delete(this.constructor.tableName, {id: this.rowID});

      this._rowID = null;
      this.createdAt = null;
      this.updatedAt = null;
    }

    return this;
  }

  async loadOne(name, model, id) {
    const ivar = '_' + name;

    if (this[ivar]) {
      return this[ivar];
    }

    this[ivar] = await model.findFirst(this.db, {id: id || this[ivar + 'RowID']});

    return this[ivar];
  }

  setOne(name, instance) {
    const ivar = '_' + name;

    if (instance) {
      this[ivar] = instance;
      this[ivar + 'RowID'] = instance.rowID;
    } else {
      this[ivar] = null;
      this[ivar + 'RowID'] = null;
    }
  }
}
