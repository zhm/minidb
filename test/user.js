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
      { name: 'birthDate', column: 'birth_date', type: 'date' }
    ];
  }
}

PersistentObject.register(User);
