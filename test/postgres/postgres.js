import chai from 'chai';
import {Postgres} from '../../src';

chai.should();

describe('postgres', () => {
  it('creates a table', async (done) => {
    try {
      const db = new Postgres({db: 'dbname = minidb'});

      await db.execute('DROP TABLE IF EXISTS test_table');
      await db.execute('CREATE TABLE IF NOT EXISTS test_table (id bigserial NOT NULL, name text)');

      let id = null;

      id = await db.insert('test_table', {name: 'Bob'}, {pk: 'id'});
      id.should.eql(1);

      id = await db.insert('test_table', {name: 'John'}, {pk: 'id'});
      id.should.eql(2);

      id = await db.insert('test_table', {name: 'Terry'}, {pk: 'id'});
      id.should.eql(3);

      await db.update('test_table', {id: 1}, {name: 'Jim'});

      const rows = await db.all('SELECT * FROM test_table ORDER BY id');
      rows[0].name.should.eql('Jim');
      rows.length.should.eql(3);

      const all = await db.findAllByAttributes('test_table', null, {name: 'Jim', id: 1});
      all[0].name.should.eql('Jim');
      all[0].id.should.eql(1);
      all.length.should.eql(1);

      const first = await db.findFirstByAttributes('test_table', null, {name: 'Jim', id: 1});
      first.name.should.eql('Jim');

      done();
    } catch (ex) {
      done(ex);
    }
  });

  it('fails gracefully on transaction error', async (done) => {
    try {
      const db = new Postgres({db: 'dbname = minidb'});

      const errors = [];

      try {
        await db.transaction(async (database) => {
          await database.execute('DROP TABLE IF EXISTS test_table');
          await database.execute('CREATE TABLE IF NOT EXISTS test_table (id bigserial NOT NULL, name text)');
          await database.execute('DROP TABLE does_not_exist');
        });
      } catch (ex) {
        errors.push(ex);
      }

      try {
        await db.transaction(async (database) => {
          await database.execute('DROP TABLE IF EXISTS test_table');
          await database.execute('CREATE TABLE IF NOT EXISTS test_table (id bigserial NOT NULL, name text)');
          await database.execute('DROP TABLE does_not_exist');
        });
      } catch (ex) {
        errors.push(ex);
      }

      errors.length.should.eql(2);

      done();
    } catch (ex) {
      done(ex);
    }
  });
});
