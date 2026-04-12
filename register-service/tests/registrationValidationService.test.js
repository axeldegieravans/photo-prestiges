const {
  assertParticipant,
  assertOwner,
  validateRegistrationId,
  assertTargetOwner
} = require('../src/services/registrationValidationService');

test('registration validation accepts the right roles', () => {
  expect(() => assertParticipant({ role: 'PARTICIPANT' })).not.toThrow();
  expect(() => assertOwner({ role: 'OWNER' })).not.toThrow();
});

test('registration validation rejects invalid ids and wrong owners', () => {
  expect(() => validateRegistrationId('invalid')).toThrow('Invalid registration id');

  expect(() => assertParticipant({ role: 'OWNER' })).toThrow('Only participants can perform this action');

  expect(() => assertOwner({ role: 'PARTICIPANT' })).toThrow('Only owners can perform this action');

  expect(() => assertTargetOwner({ ownerId: 'owner-1' }, { userId: 'owner-2' }))
    .toThrow('You can only access registrations for your own target');
});
