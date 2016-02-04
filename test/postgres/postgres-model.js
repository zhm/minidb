import chai from 'chai';
import aspromised from 'chai-as-promised';

import models from '../models';
import {Postgres} from '../../src';

chai.use(aspromised);
chai.should();

const script = `
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

let context = { db: null };

async function setup(done) {
  try {
    context.db = new Postgres({db: 'dbname = minidb'});

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
  context.db = null;
  done();
}

models('postgres', context, setup, teardown);
