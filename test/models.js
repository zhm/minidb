/* eslint no-unused-expressions: 0 */

import chai from 'chai';
import aspromised from 'chai-as-promised';
import {shouldThrow, mochaAsync} from './helper';

import User from './user';

chai.use(aspromised);
const should = chai.should();

export default function models(driver, context, setup, teardown) {
  describe('user model ' + driver, () => {
    beforeEach(setup);
    afterEach(teardown);

    it('creates an instance', async (done) => {
      try {
        const {db} = context;

        {
          const user = await User.findOrCreate(db, {name: 'John', email: 'john@example.com', age: 30});
          await user.save();
        }

        {
          const user2 = await User.findOrCreate(db, {name: 'John', email: 'john@example.com', age: 30});
          await user2.save();
          user2.rowID.should.eql(1);
        }

        done();
      } catch (ex) {
        console.log(ex);
        done(ex);
      }
    });

    it('creates multiple instances', mochaAsync(async () => {
      const {db} = context;

      {
        const user = await User.findOrCreate(db, {name: 'John', email: 'john@example.com', age: 30});
        await user.save();
      }

      {
        const user2 = await User.findOrCreate(db, {name: 'Bob', email: 'bob@example.com', age: 32});
        await user2.save();
        // user2.rowID.should.eql(2);
      }

      {
        const user3 = await User.findOrCreate(db, {name: 'Bob'});
        await user3.save();
        // user3.rowID.should.eql(2);
      }

      (await db.get('SELECT COUNT(1) AS count FROM users')).count.should.eql(2);

      {
        const user = await User.findFirst(db, {name: 'Bob'});
        user.age.should.eql(32);
        // user.rowID.should.eql(2);
      }
    }));

    it('deletes instances', mochaAsync(async () => {
      const {db} = context;

      const user = await User.findOrCreate(db, {name: 'John', email: 'john@example.com', age: 30});
      await user.save();

      (await User.count(db)).should.eql(1);

      await user.delete();

      should.not.exist(user.rowID);

      (await User.count(db)).should.eql(0);
    }));

    it('errors when a unique index is violated', mochaAsync(async () => {
      const {db} = context;
      let user = null;

      user = User.create(db, {name: 'John', email: 'john@example.com', age: 30});

      await user.save();

      user = User.create(db, {name: 'John', email: 'john@example.com', age: 30});

      await shouldThrow(user.save());

      (await User.count(db)).should.eql(1);
    }));

    it('errors when a non-null column is saved', mochaAsync(async () => {
      const {db} = context;
      const user = User.create(db, {name: 'John', email: 'john@example.com', age: null});

      await shouldThrow(user.save());

      should.not.exist(user.rowID);

      (await User.count(db)).should.eql(0);
    }));

    it('updates the timestamps properly', mochaAsync(async () => {
      const {db} = context;

      const user = await User.findOrCreate(db, {name: 'John', email: 'john@example.com', age: 30});
      await user.save();

      const createdAt = user.createdAt;

      (user.createdAt instanceof Date).should.be.true;

      user.createdAt.should.not.be.null;
      user.updatedAt.should.eql(user.createdAt);

      // wait 1ms to guarantee the timestamp gets changed
      await new Promise(resolve => setTimeout(resolve, 1));

      await user.save();

      user.updatedAt.getTime().should.not.eql(createdAt.getTime());
    }));

    it('handles datetime columns', mochaAsync(async () => {
      const {db} = context;

      const user = await User.findOrCreate(db, {name: 'Terry Jenkins', email: 'terry@example.com', age: 30, signed_up_at: new Date()});
      await user.save();

      const test = await User.findFirst(db, {name: 'Terry Jenkins'});

      (test.createdAt instanceof Date).should.be.true;
      (test._signedUpAt instanceof Date).should.be.true;
    }));
  });
}
