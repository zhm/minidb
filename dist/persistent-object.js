'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _util = require('util');

function _asyncToGenerator(fn) { return function () { var gen = fn.apply(this, arguments); return new Promise(function (resolve, reject) { function step(key, arg) { try { var info = gen[key](arg); var value = info.value; } catch (error) { reject(error); return; } if (info.done) { resolve(value); } else { return Promise.resolve(value).then(function (value) { return step("next", value); }, function (err) { return step("throw", err); }); } } return step("next"); }); }; }

const models = [];

class PersistentObject {
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

  static findFirst(ModelClass, db, attributes) {
    return _asyncToGenerator(function* () {
      const row = yield db.findFirstByAttributes(ModelClass.tableName, null, attributes);

      if (row) {
        const instance = new ModelClass(db);

        instance.updateFromDatabaseAttributes(row);

        return instance;
      }

      return null;
    })();
  }

  static findAll(ModelClass, db, attributes, orderBy) {
    return _asyncToGenerator(function* () {
      const rows = yield db.findAllByAttributes(ModelClass.tableName, null, attributes, orderBy);

      return rows.map(function (row) {
        const instance = new ModelClass(db);
        instance.updateFromDatabaseAttributes(row);
        return instance;
      });
    })();
  }

  static findOrCreate(ModelClass, db, attributes) {
    return _asyncToGenerator(function* () {
      const row = yield db.findFirstByAttributes(ModelClass.tableName, null, attributes);

      const instance = new ModelClass(db);

      instance.updateFromDatabaseAttributes(row || attributes);

      return instance;
    })();
  }

  static count(ModelClass, db, attributes) {
    return _asyncToGenerator(function* () {
      const result = yield db.findFirstByAttributes(ModelClass.tableName, ['COUNT(1) AS count'], attributes);

      return result.count;
    })();
  }

  static get modelMethods() {
    return ['findFirst', 'findAll', 'findOrCreate', 'count'];
  }

  static get models() {
    return models.slice();
  }

  static register(modelClass) {
    models.push(modelClass);

    const wrap = method => {
      return function () {
        for (var _len = arguments.length, params = Array(_len), _key = 0; _key < _len; _key++) {
          params[_key] = arguments[_key];
        }

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
        throw Error((0, _util.format)('column %s cannot be null', name));
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
    return this.id > 0;
  }

  save(options) {
    var _this = this;

    return _asyncToGenerator(function* () {
      options = options || {};

      if (_this.beforeSave) {
        yield _this.beforeSave(options);
      }

      const values = _this.databaseValues;

      if (options.timestamps !== false) {
        _this.updateTimestamps();
      }

      values.created_at = _this.createdAt;
      values.updated_at = _this.updatedAt;

      if (!_this.isPersisted) {
        _this.id = yield _this.db.insert(_this.constructor.tableName, values, { pk: 'id' });
      } else {
        yield _this.db.update(_this.constructor.tableName, { id: _this.id }, _this.changes);
      }

      // It's not possible to override `async` methods currently (and be able to use `super`)
      if (_this.afterSave) {
        yield _this.afterSave(options);
      }

      return _this;
    })();
  }

  delete(options) {
    var _this2 = this;

    return _asyncToGenerator(function* () {
      options = options || {};

      if (_this2.isPersisted) {
        yield _this2.db.delete(_this2.constructor.tableName, { id: _this2.id });

        _this2.id = null;
        _this2.createdAt = null;
        _this2.updatedAt = null;
      }

      return _this2;
    })();
  }

  loadOne(name, model, id) {
    var _this3 = this;

    return _asyncToGenerator(function* () {
      if (_this3['_' + name]) {
        return _this3['_' + name];
      }

      _this3['_' + name] = yield model.findFirst(_this3.db, { id: id || _this3[name + 'ID'] });

      return _this3['_' + name];
    })();
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
exports.default = PersistentObject;
//# sourceMappingURL=persistent-object.js.map