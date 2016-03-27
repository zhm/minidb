'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _util = require('util');

var _mixmatch = require('mixmatch');

var _mixmatch2 = _interopRequireDefault(_mixmatch);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _asyncToGenerator(fn) { return function () { var gen = fn.apply(this, arguments); return new Promise(function (resolve, reject) { function step(key, arg) { try { var info = gen[key](arg); var value = info.value; } catch (error) { reject(error); return; } if (info.done) { resolve(value); } else { return Promise.resolve(value).then(function (value) { return step("next", value); }, function (err) { return step("throw", err); }); } } return step("next"); }); }; }

const models = [];

class PersistentObject extends _mixmatch2.default {
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

  static findFirst(ModelClass, db, attributes) {
    return _asyncToGenerator(function* () {
      const row = yield db.findFirstByAttributes(ModelClass.tableName, null, attributes);

      if (row) {
        const instance = new ModelClass();

        instance.initializePersistentObject(db, row);

        return instance;
      }

      return null;
    })();
  }

  static findAll(ModelClass, db, attributes, orderBy) {
    return _asyncToGenerator(function* () {
      const rows = yield db.findAllByAttributes(ModelClass.tableName, null, attributes, orderBy);

      return rows.map(function (row) {
        const instance = new ModelClass();

        instance.initializePersistentObject(db, row);

        return instance;
      });
    })();
  }

  static findOrCreate(ModelClass, db, attributes) {
    return _asyncToGenerator(function* () {
      const row = yield db.findFirstByAttributes(ModelClass.tableName, null, attributes);

      const instance = new ModelClass();

      instance.initializePersistentObject(db, row || attributes);

      return instance;
    })();
  }

  static create(ModelClass, db, attributes) {
    const instance = new ModelClass();

    instance.initializePersistentObject(db, attributes);

    return instance;
  }

  static count(ModelClass, db, attributes) {
    return _asyncToGenerator(function* () {
      const result = yield db.findFirstByAttributes(ModelClass.tableName, ['COUNT(1) AS count'], attributes);

      return result.count;
    })();
  }

  static get modelMethods() {
    return ['findFirst', 'findAll', 'findOrCreate', 'create', 'count'];
  }

  static get models() {
    return models.slice();
  }

  static register(modelClass) {
    models.push(modelClass);

    PersistentObject.includeInto(modelClass);

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
    return this.rowID > 0;
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

      values.created_at = _this.db.toDatabase(_this.createdAt, { type: 'datetime' });
      values.updated_at = _this.db.toDatabase(_this.updatedAt, { type: 'datetime' });

      if (!_this.isPersisted) {
        _this._rowID = yield _this.db.insert(_this.constructor.tableName, values, { pk: 'id' });
      } else {
        yield _this.db.update(_this.constructor.tableName, { id: _this.rowID }, values);
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
        yield _this2.db.delete(_this2.constructor.tableName, { id: _this2.rowID });

        _this2._rowID = null;
        _this2.createdAt = null;
        _this2.updatedAt = null;
      }

      return _this2;
    })();
  }

  loadOne(name, model, id) {
    var _this3 = this;

    return _asyncToGenerator(function* () {
      const ivar = '_' + name;

      if (_this3[ivar]) {
        return _this3[ivar];
      }

      _this3[ivar] = yield model.findFirst(_this3.db, { id: id || _this3[ivar + 'RowID'] });

      return _this3[ivar];
    })();
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
exports.default = PersistentObject;
//# sourceMappingURL=persistent-object.js.map