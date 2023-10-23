module.exports = [
  'strapi::errors',
  'strapi::security',
  'strapi::cors',
  'strapi::poweredBy',
  'strapi::logger',
  'strapi::query',
  { 
    name: 'strapi::body',
    config: { 
      includeUnparsed: true,
      sizeLimit: 300 * 1024 * 1024,
      formidable: {
        maxFileSize: 300 * 1024 * 1024, // multipart data, modify here limit of uploaded file size
      },
    } 
  },
  'strapi::favicon',
  'strapi::public',
];
