import rimraf from 'rimraf';
import chai from 'chai';
import path from 'path';
import aspromised from 'chai-as-promised';

import models from '../models';
import {SQLite} from '../../src';

chai.use(aspromised);
chai.should();

const script = `
DROP TABLE IF EXISTS users;

CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  age INTEGER NOT NULL,
  height REAL,
  birth_date REAL,
  created_at REAL NOT NULL,
  updated_at REAL NOT NULL
);

CREATE UNIQUE INDEX idx_user_email ON users (email);
`;

let context = { db: null };

async function setup(done) {
  try {
    const file = path.join(__dirname, 'test.db');

    rimraf.sync(file);

    context.db = new SQLite({file: file});

    await context.db.open();

    for (const sql of script.split(';')) {
      if (sql.trim().length) {
        await context.db.execute(sql);
      }
    }
  } catch (ex) {
    done(ex);
    throw ex;
  }

  done();
}

async function teardown(done) {
  try {
    await context.db.close();
    context.db = null;
  } catch (ex) {
    done(ex);
    throw ex;
  }

  done();
}

models('sqlite', context, setup, teardown);
