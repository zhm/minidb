# minidb [![Build Status](https://travis-ci.org/zhm/minidb.svg?branch=master)](https://travis-ci.org/zhm/minidb)

A small object wrapper for PostgreSQL and SQLite. It has very little sugar and is intentionally low-level. It does not do migrations, relationships, identity management, or any other magic.

## Installation

```sh
npm install minidb
```


## Usage

```js
import {PersistentObject, SQLite} from 'minidb';

export default class User extends PersistentObject {
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

// use the API
const db = new SQLite({file: 'users.db'});
//const db = new Postgres({db: 'dbname = minidb'});

await db.open();

const setupScript = `
DROP TABLE IF EXISTS users;

CREATE TABLE users (
  id bigserial NOT NULL,
  name text NOT NULL,
  email text NOT NULL,
  age bigint NOT NULL,
  height double precision,
  birth_date date,
  created_at double precision,
  updated_at double precision
);

CREATE UNIQUE INDEX idx_user_email ON users (email);
`;

await db.execute(setupScript);

const user = await User.findOrCreate(db, {name: 'John', email: 'john@example.com', age: 30});

user.height = 72.3;

await user.save();
```
