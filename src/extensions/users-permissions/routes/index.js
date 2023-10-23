"use strict";

module.exports = {
  admin: require("@strapi/plugin-users-permissions/server/routes/admin"),
  "content-api": require("./content-api"),
};
