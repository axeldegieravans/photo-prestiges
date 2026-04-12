const { getSwaggerDocs, getSwaggerUiOptions } = require('../src/utils/docsConfig');

test('gateway docs config exposes the public and internal specs', () => {
  const docs = getSwaggerDocs();

  expect(docs).toEqual([
    {
      url: '/docs/openapi/public.openapi.yaml',
      name: 'Gateway Public API'
    },
    {
      url: '/docs/openapi/internal.openapi.yaml',
      name: 'Internal Demo API'
    }
  ]);
});

test('gateway swagger ui options use the expected title', () => {
  const options = getSwaggerUiOptions();

  expect(options.explorer).toBe(true);
  expect(options.customSiteTitle).toBe('Photo Prestiges API Docs');
  expect(options.swaggerOptions.urls).toHaveLength(2);
});
