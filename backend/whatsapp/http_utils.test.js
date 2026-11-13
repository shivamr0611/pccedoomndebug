const test = require('node:test');
const assert = require('node:assert/strict');
const { Readable } = require('node:stream');
const { readJsonBody } = require('./http_utils');

test('readJsonBody preserves UTF-8 characters split across chunks', async () => {
  const body = Buffer.from('{"message":"मराठी"}');
  const splitAt = body.indexOf(Buffer.from('र')) + 1;
  const request = Readable.from([body.subarray(0, splitAt), body.subarray(splitAt)]);

  assert.deepEqual(await readJsonBody(request), { message: 'मराठी' });
});

test('readJsonBody rejects invalid and oversized request bodies', async () => {
  await assert.rejects(readJsonBody(Readable.from(['{bad'])), { statusCode: 400 });
  await assert.rejects(readJsonBody(Readable.from(['12345']), 4), { statusCode: 413 });
});
