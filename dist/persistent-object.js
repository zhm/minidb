'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; };

var _util = require('util');

var _mixmatch = require('mixmatch');

var _mixmatch2 = _interopRequireDefault(_mixmatch);

var _assert = require('assert');

var _assert2 = _interopRequireDefault(_assert);

var _database = require('./database');

var _database2 = _interopRequireDefault(_database);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _objectWithoutProperties(obj, keys) { var target = {}; for (var i in obj) { if (keys.indexOf(i) >= 0) continue; if (!Object.prototype.hasOwnProperty.call(obj, i)) continue; target[i] = obj[i]; } return target; }

function _asyncToGenerator(fn) { return function () { var gen = fn.apply(this, arguments); return new Promise(function (resolve, reject) { function step(key, arg) { try { var info = gen[key](arg); var value = info.value; } catch (error) { reject(error); return; } if (info.done) { resolve(value); } else { return Promise.resolve(value).then(function (value) { step("next", value); }, function (err) { step("throw", err); }); } } return step("next"); }); }; }

const models = [];

function checkDatabase(db) {
  (0, _assert2.default)(db instanceof _database2.default, 'invalid db');
}

class PersistentObject extends _mixmatch2.default {
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

  static findFirstColumns(ModelClass, db, attributes, columns) {
    return _asyncToGenerator(function* () {
      return yield db.findFirstByAttributes(ModelClass.tableName, columns, attributes);
    })();
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

  static findAllColumns(ModelClass, db, attributes, columns) {
    return _asyncToGenerator(function* () {
      return yield db.findAllByAttributes(ModelClass.tableName, columns, attributes);
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

  static findEach(ModelClass, db, options, callback) {
    return db.findEachByAttributes(_extends({ tableName: ModelClass.tableName }, options), (() => {
      var _ref = _asyncToGenerator(function* (_ref2) {
        let columns = _ref2.columns,
            values = _ref2.values,
            index = _ref2.index;

        if (values) {
          const instance = new ModelClass();

          instance.initializePersistentObject(db, values);

          return yield callback(instance, { columns: columns, values: values, index: index });
        }

        return null;
      });

      return function (_x) {
        return _ref.apply(this, arguments);
      };
    })());
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
    return ['findFirst', 'findFirstColumns', 'findAll', 'findAllColumns', 'findEach', 'findOrCreate', 'create', 'count'];
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

  save() {
    var _this = this;

    let _ref3 = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};

    let db = _ref3.db,
        timestamps = _ref3.timestamps,
        rest = _objectWithoutProperties(_ref3, ['db', 'timestamps']);

    return _asyncToGenerator(function* () {
      db = db || _this.db;

      checkDatabase(db);

      if (_this.beforeSave) {
        const result = yield _this.beforeSave(_extends({ db: db, timestamps: timestamps }, rest));

        if (result === false) {
          return _this;
        }
      }

      if (timestamps !== false) {
        _this.updateTimestamps();
      }

      const values = _this.databaseValues(db);

      values.created_at = db.toDatabase(_this.createdAt, { type: 'datetime' });
      values.updated_at = db.toDatabase(_this.updatedAt, { type: 'datetime' });

      if (!_this.isPersisted) {
        _this._rowID = yield db.insert(_this.constructor.tableName, values, { pk: 'id' });
      } else {
        yield db.update(_this.constructor.tableName, { id: _this.rowID }, values);
      }

      // It's not possible to override `async` methods currently (and be able to use `super`)
      if (_this.afterSave) {
        yield _this.afterSave(_extends({ db: db, timestamps: timestamps }, rest));
      }

      return _this;
    })();
  }

  delete() {
    var _this2 = this;

    var _ref4 = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};

    let db = _ref4.db;
    return _asyncToGenerator(function* () {
      db = db || _this2.db;

      checkDatabase(db);

      if (_this2.isPersisted) {
        yield db.delete(_this2.constructor.tableName, { id: _this2.rowID });

        _this2._rowID = null;
        _this2.createdAt = null;
        _this2.updatedAt = null;
      }

      return _this2;
    })();
  }

  loadOne(name, model, id, db) {
    var _this3 = this;

    return _asyncToGenerator(function* () {
      db = db || _this3.db;

      checkDatabase(db);

      const ivar = '_' + name;

      const pk = id || _this3[ivar + 'RowID'];

      if (pk == null) {
        return null;
      }

      if (_this3[ivar]) {
        return _this3[ivar];
      }

      const instance = yield model.findFirst(db, { id: pk });

      _this3.setOne(name, instance);

      return _this3[ivar];
    })();
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