import _ from 'lodash';
import {format} from 'util';

const models = [];

export default class PersistentObject {
  constructor(db, attributes) {
    this.initializePersistentObject(db, attributes);
  }

  initializePersistentObject(db, attributes) {
    this.db = db;

    if (attributes) {
      this.updateFromDatabaseAttributes(attributes);
    }

    this.id = null;
    this.createdAt = null;
    this.updatedAt = null;
  }

  static async findFirst(ModelClass, db, attributes) {
    const row = await db.findFirstByAttributes(ModelClass.tableName, null, attributes);

    if (row) {
      const instance = new ModelClass(db);

      instance.updateFromDatabaseAttributes(row);

      return instance;
    }

    return null;
  }

  static async findAll(ModelClass, db, attributes, orderBy) {
    const rows = await db.findAllByAttributes(ModelClass.tableName, null, attributes, orderBy);

    return rows.map((row) => {
      const instance = new ModelClass(db);
      instance.updateFromDatabaseAttributes(row);
      return instance;
    });
  }

  static async findOrCreate(ModelClass, db, attributes) {
    const row = await db.findFirstByAttributes(ModelClass.tableName, null, attributes);

    const instance = new ModelClass(db);

    instance.updateFromDatabaseAttributes(row || attributes);

    return instance;
  }

  static async count(ModelClass, db, attributes) {
    const result = await db.findFirstByAttributes(ModelClass.tableName, ['COUNT(1) AS count'], attributes);

    return result.count;
  }

  static get modelMethods() {
    return ['findFirst', 'findAll', 'findOrCreate', 'count'];
  }

  static get models() {
    return models.slice();
  }

  static register(modelClass) {
    models.push(modelClass);

    const wrap = (method) => {
      return function (...params) {
        const args = [modelClass].concat(params);
        return PersistentObject[method].apply(PersistentObject, args);
      };
    };

    for (let method of PersistentObject.modelMethods) {
      modelClass[method] = wrap(method);
    }
  }

  updateFromDatabaseAttributes(attributes) {
    for (const column of this.constructor.columns) {
      const name = column.name;
      const value = attributes[column.column];

      // if (value == null && column[2] && column[2].null === false) {
      //   console.warn(format('column %s cannot be null', name));
      // }

      this[name] = this.db.fromDatabase(value, column);
    }

    this.id = this.toNumber(attributes.id);
  }

  get databaseValues() {
    const values = {};

    for (const column of this.constructor.columns) {
      const name = column.name;
      const value = this[name];

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
    const now = new Date().getTime();

    if (!this.createdAt) {
      this.createdAt = now;
    }

    this.updatedAt = now;
  }

  get isPersisted() {
    return this.id > 0;
  }

  async save(options) {
    options = options || {};

    if (this.beforeSave) {
      await this.beforeSave(options);
    }

    const values = this.databaseValues;

    if (options.timestamps !== false) {
      this.updateTimestamps();
    }

    _.merge(values, {
      created_at: this.createdAt,
      updated_at: this.updatedAt
    });

    if (!this.isPersisted) {
      this.id = await this.db.insert(this.constructor.tableName, values, {pk: 'id'});
    } else {
      await this.db.update(this.constructor.tableName, {id: this.id}, this.changes);
    }

    // It's not possible to override `async` methods currently (and be able to use `super`)
    if (this.afterSave) {
      await this.afterSave(options);
    }

    return this;
  }

  async delete(options) {
    options = options || {};

    if (this.isPersisted) {
      await this.db.delete(this.constructor.tableName, {id: this.id});

      this.id = null;
      this.createdAt = null;
      this.updatedAt = null;
    }

    return this;
  }

  async loadOne(name, model, id) {
    if (this['_' + name]) {
      return this['_' + name];
    }

    this['_' + name] = await model.findFirst(this.db, {id: id || this[name + 'ID']});

    return this['_' + name];
  }

  setOne(name, instance) {
    if (instance) {
      this['_' + name] = instance;
      this[name + 'ID'] = instance.id;
    } else {
      this['_' + name] = null;
      this[name + 'ID'] = null;
    }
  }
}
