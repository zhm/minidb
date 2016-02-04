/* eslint no-unused-expressions: 0 */

import chai from 'chai';
import aspromised from 'chai-as-promised';

import SQLite from '../../src/sqlite';

chai.use(aspromised);
chai.should();

describe('sqlite', () => {
  it('creates a table', async (done) => {
    try {
      const file = ':memory:';

      const db = new SQLite({file: file});

      await db.open();
      await db.execute('DROP TABLE IF EXISTS test_table');
      await db.execute('CREATE TABLE IF NOT EXISTS test_table (id integer primary key autoincrement, name text)');

      let id = null;

      id = await db.insert('test_table', {name: 'Bob'});
      id.should.eql(1);

      id = await db.insert('test_table', {name: 'John'});
      id.should.eql(2);

      id = await db.insert('test_table', {name: 'Terry'});
      id.should.eql(3);

      await db.update('test_table', {id: 1}, {name: 'Jim'});

      const rows = await db.all('SELECT * FROM test_table');
      rows[0].name.should.eql('Jim');
      rows.length.should.eql(3);

      const all = await db.findAllByAttributes('test_table', null, {name: 'Jim', id: 1});
      all[0].name.should.eql('Jim');
      all[0].id.should.eql(1);
      all.length.should.eql(1);

      const first = await db.findFirstByAttributes('test_table', null, {name: 'Jim', id: 1});
      first.name.should.eql('Jim');

      db.findFirstByAttributes('does_not_exist', null, {name: 'Jim', id: 1}).should.be.rejected;

      await db.close();

      done();
    } catch (ex) {
      done(ex);
    }
  });
});
