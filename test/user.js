import {PersistentObject, Database} from '../src';
import BigNumber from 'bignumber.js';

Database.setTypeConverter('decimal', {
  toDatabase: (value) => {
    return value.toString();
  },

  fromDatabase: (value) => {
    return BigNumber(value);
  }
});

export default class User {
  static get tableName() {
    return 'users';
  }

  static get columns() {
    return [
      { name: 'name', column: 'name', type: 'string', null: false, simple: true },
      { name: 'email', column: 'email', type: 'string', null: false, simple: true },
      { name: 'age', column: 'age', type: 'integer', null: false, simple: true },
      { name: 'height', column: 'height', type: 'double', simple: true },
      { name: 'birthDate', column: 'birth_date', type: 'date', simple: true },
      { name: 'signedUpAt', column: 'signed_up_at', type: 'datetime', simple: true },
      { name: 'revenue', column: 'revenue', type: 'decimal', simple: true }
    ];
  }

  get name() {
    return this._name;
  }

  get email() {
    return this._email;
  }

  get age() {
    return this._age;
  }

  get height() {
    return this._height;
  }

  get birthDate() {
    return this._birthDate;
  }
}

PersistentObject.register(User);
