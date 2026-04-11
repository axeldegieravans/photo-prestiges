const { buildQueryString } = require('../src/utils/queryString');

test('read query strings skip empty values', () => {
  expect(
    buildQueryString({
      page: 1,
      limit: 100,
      city: 'Den Bosch',
      search: 'tower',
      empty: '',
      nil: null,
      undef: undefined
    })
  ).toBe('?page=1&limit=100&city=Den+Bosch&search=tower');
});
