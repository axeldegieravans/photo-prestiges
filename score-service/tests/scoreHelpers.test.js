const {
  assertParticipant,
  assertOwner
} = require('../src/services/submissionValidationService');
const {
  buildSubmissionImageUrl,
  deleteFileIfExists
} = require('../src/utils/fileStorage');
const { normalizePagination } = require('../src/utils/pagination');

test('score helpers validate roles and pagination', () => {
  expect(() => assertParticipant({ role: 'PARTICIPANT' })).not.toThrow();
  expect(() => assertOwner({ role: 'OWNER' })).not.toThrow();

  expect(normalizePagination('0', '200')).toEqual({
    page: 1,
    limit: 100,
    skip: 0
  });
});

test('score file helper uses the public base url', () => {
  process.env.PUBLIC_BASE_URL = 'http://example.test';

  expect(buildSubmissionImageUrl('submission.png'))
    .toBe('http://example.test/uploads/submissions/submission.png');
});

test('deleteFileIfExists ignores empty paths', async () => {
  await expect(deleteFileIfExists('')).resolves.toBeUndefined();
});
