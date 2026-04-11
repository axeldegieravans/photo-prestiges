const getSwaggerDocs = () => {
  return [
    {
      url: '/docs/openapi/public.openapi.yaml',
      name: 'Gateway Public API'
    },
    {
      url: '/docs/openapi/internal.openapi.yaml',
      name: 'Internal Demo API'
    }
  ];
};

const getSwaggerUiOptions = () => {
  return {
    explorer: true,
    customSiteTitle: 'Photo Prestiges API Docs',
    swaggerOptions: {
      urls: getSwaggerDocs()
    }
  };
};

module.exports = {
  getSwaggerDocs,
  getSwaggerUiOptions
};
