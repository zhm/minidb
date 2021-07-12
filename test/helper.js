import chai from 'chai';

const should = chai.should();

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

export { shouldThrow, shouldNotThrow };
