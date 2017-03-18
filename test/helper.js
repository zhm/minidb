import chai from 'chai';

const should = chai.should();

function mochaAsync(test) {
  return async (done) => {
    try {
      await test();
      done();
    } catch (err) {
      console.log('ERR', err);
      done(err);
    }
  };
}

async function shouldThrow(promise) {
  let error = null;

  try {
    await promise;
  } catch (ex) {
    error = ex;
  }

  should.exist(error);
}

async function shouldNotThrow(promise) {
  let error = null;

  try {
    await promise;
  } catch (ex) {
    error = ex;
  }

  should.not.exist(error);
}

export {mochaAsync, shouldThrow, shouldNotThrow};
