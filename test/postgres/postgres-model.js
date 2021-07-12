import chai from 'chai';
import aspromised from 'chai-as-promised';

import models from '../models';
import { Postgres } from '../../src';
import * as minipg from 'minipg';

Postgres.driver = minipg;

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
  signed_up_at timestamp with time zone,
  revenue decimal(20, 8),
  created_at timestamp without time zone NOT NULL,
  updated_at timestamp without time zone NOT NULL
);

CREATE UNIQUE INDEX idx_user_email ON users (email);
`;

let context = { db: null };

async function setup() {
  try {
    context.db = new Postgres({db: 'dbname = minidb'});

    for (const sql of script.split(';')) {
      if (sql.trim().length) {
        await context.db.execute(sql);
      }
    }
  } catch (ex) {
    throw ex;
  }
}

async function teardown() {
  context.db = null;
}

models('postgres', context, setup, teardown);
