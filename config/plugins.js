module.exports = ({ env }) => ({
  email: {
    config: {
      provider: "sendgrid",
      providerOptions: {
        apiKey: env("SENDGRID_API_KEY"),
      },
      settings: {
        from: "florian@visiodome.io",
        defaultFrom: "florian@visiodome.io",
        defaultReplyTo: "florian@visiodome.io",
      },
    },
  },
  wysiwyg: {
    enabled: true,
    resolve: "./src/plugins/wysiwyg",
  },
});