const {
  assertOwner,
  assertParticipant,
  assertTargetOwnership,
  validateTargetId,
  validateCoordinates,
  validateTargetStatus
} = require('../src/services/targetValidationService');
const { buildTargetImageUrl } = require('../src/utils/fileStorage');

test('target validation accepts valid status and coordinates', () => {
  expect(validateTargetStatus('open')).toBe('OPEN');
  expect(validateTargetStatus('CLOSED')).toBe('CLOSED');
  expect(validateTargetStatus(undefined)).toBeUndefined();

  expect(() =>
    validateCoordinates({ latitude: '52.1', longitude: '5.1' })
  ).not.toThrow();
});

test('target validation rejects invalid ids, coordinates and roles', () => {
  expect(() => validateTargetId('nope')).toThrow('Invalid target id');
  expect(() => validateCoordinates({ latitude: '120' }))
    .toThrow('latitude must be a number between -90 and 90');
  expect(() => validateCoordinates({ longitude: '220' }))
    .toThrow('longitude must be a number between -180 and 180');
  expect(() => validateTargetStatus('broken')).toThrow('status must be OPEN or CLOSED');
  expect(() => assertOwner({ role: 'PARTICIPANT' })).toThrow('Only owners can perform this action');
  expect(() => assertParticipant({ role: 'OWNER' })).toThrow('Only participants can perform this action');
  expect(() =>
    assertTargetOwnership(
      { ownerId: 'owner-1' },
      { userId: 'owner-2' }
    )
  ).toThrow('You can only manage your own target');
});

test('target image urls use the public base url', () => {
  process.env.PUBLIC_BASE_URL = 'http://example.test';

  expect(buildTargetImageUrl('photo.jpg'))
    .toBe('http://example.test/uploads/targets/photo.jpg');
});
