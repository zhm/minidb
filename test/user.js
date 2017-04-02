import {PersistentObject} from '../src';

export default class User {
  static get tableName() {
    return 'users';
  }

  static get columns() {
    return [
      { name: 'name', column: 'name', type: 'string', null: false },
      { name: 'email', column: 'email', type: 'string', null: false },
      { name: 'age', column: 'age', type: 'integer', null: false },
      { name: 'height', column: 'height', type: 'double' },
      { name: 'birthDate', column: 'birth_date', type: 'date' },
      { name: 'signedUpAt', column: 'signed_up_at', type: 'datetime' }
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
