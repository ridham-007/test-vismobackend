module.exports = ({ env }) => ({
  auth: {
    secret: env("ADMIN_JWT_SECRET", "be56bca3ff0e8efd0194c3af162d2801"),
  },
  //If you have enabled the API Token, The SALT should also be provided.
  apiToken: {
    salt: env('API_TOKEN_SALT', '1234')
  }
});
