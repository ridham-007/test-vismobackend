"use strict";
const { getService } = require("@strapi/plugin-users-permissions/server/utils");
const { generateRoomName } = require("./auth");

const _ = require("lodash");
const utils = require("@strapi/utils");
const axios = require("axios");
const { ValidationError, ApplicationError } = utils.errors;
const { sanitize } = utils;

const sanitizeOutput = (user, ctx) => {
  const schema = strapi.getModel("plugin::users-permissions.user");
  const { auth } = ctx.state;
  return sanitize.contentAPI.output(user, schema, { auth });
};

module.exports = {
  async update(ctx) {
    const { auth, user } = ctx.state;
    const { id } = ctx.params;
    const { email, username, password } = ctx.request.body;

    // if the Request is coming from Token API, then We don't have any LoggedIn User
    // In this case, We should only allow user by requesting credentials.
    // Usually api-token is like a Service Account that is accessible via all
    // But it allows everyone to GET / POST Anonymously.
    // something
    if (
      auth.strategy.name === "api-token" ||
      auth.strategy.name === "users-permissions"
    ) {
      let admin_user_id = null;
      let admin_token = null;
      let _user = null;
      await axios
        .post("http://localhost:1337/admin/login", {
          email: ctx.request.header.email,
          password: ctx.request.header.password,
        })
        .then((response) => {
          admin_token = response.data.data.token;
          admin_user_id = response.data.data.user.id;
          _user = response.data.data.user;
        })
        .catch((error) => {
          throw new ValidationError(error);
        });

      // Once the initial object is obtained, We need to list the recently logged in admin user
      // and then we need to validate the user based on token that is provided during login
      let admin_url = `http://localhost:1337/admin/users/${admin_user_id}`;
      let admin_authorization = `Bearer ${admin_token}`;

      const { data } = await axios
        .get(admin_url, {
          headers: {
            Authorization: admin_authorization,
          },
        })
        .catch((error) => {
          throw new ValidationError("Invalid Credentials");
        });

      // Once the authentication and authorization is performed, as a next step
      // the user needs to check if the authenticated user has strapi-super-admin code
      let isAdmin = data.data.roles.find(
        (x) => x.code === "strapi-super-admin"
      );
      // If it has the code, then the API will fetch and return the information of the
      // requested user to the admin user
      if (isAdmin.code === "strapi-super-admin") {
        const advancedConfigs = await strapi
          .store({ type: "plugin", name: "users-permissions", key: "advanced" })
          .get();

        if (
          _user.provider === "local" &&
          _.has(ctx.request.body, "password") &&
          !password
        ) {
          throw new ValidationError("password.notNull");
        }
        if (_.has(ctx.request.body, "username")) {
          const userWithSameUsername = await strapi
            .query("plugin::users-permissions.user")
            .findOne({ where: { username } });
          if (userWithSameUsername && userWithSameUsername.id != id) {
            throw new ApplicationError("Username already taken");
          }
        }
        if (_.has(ctx.request.body, "email") && advancedConfigs.unique_email) {
          const userWithSameEmail = await strapi
            .query("plugin::users-permissions.user")
            .findOne({ where: { email: email.toLowerCase() } });
          if (userWithSameEmail && userWithSameEmail.id != id) {
            throw new ApplicationError("Email already taken");
          }
          ctx.request.body.email = ctx.request.body.email.toLowerCase();
        }

        let updateData = {
          ...ctx.request.body,
        };
        const data = await getService("user").edit(id, updateData);
        const sanitizedData = await sanitizeOutput(data, ctx);
        ctx.send(sanitizedData);
      } else {
        // But if the user is not admin and is requesting the details of other user
        // then it will return error.
        throw new ValidationError("Invalid Credentials");
      }
      //If user is End User and is trying to access some other user by other Id
      // In this case, we don't need Id from the user as query string.
      // Becuase the current User in the Context State will have the Id
    }
  },
  async findOne(ctx) {
    const { auth, user } = ctx.state;
    const { id } = ctx.params;
    // if the Request is coming from Token API, then We don't have any LoggedIn User
    // In this case, We should only allow user by requesting credentials.
    // Usually api-token is like a Service Account that is accessible via all
    // But it allows everyone to GET / POST Anonymously.
    if (auth.strategy.name === "api-token") {
      let admin_user_id = null;
      let admin_token = null;

      // User-Permission is only for the End Users. It don't return the Admin/Editor/Autors
      // or super admin users.As API token is independed, It works as service account and has
      // no limits. First we need to request user to send correct email and password
      // Once the correct email and password is recieved, the user needs to be authenticated
      // and generate token for further requests.
      // With the current implementation, The Service Account (API Token types of users) will only
      // work if are being requested by Admin.
      await axios
        .post("http://localhost:1337/admin/login", {
          email: ctx.request.header.email,
          password: ctx.request.header.password,
        })
        .then((response) => {
          admin_token = response.data.data.token;
          admin_user_id = response.data.data.user.id;
        })
        .catch((error) => {
          throw new ValidationError("Invalid Access");
        });

      // Once the initial object is obtained, We need to list the recently logged in admin user
      // and then we need to validate the user based on token that is provided during login
      let admin_url = `http://localhost:1337/admin/users/${admin_user_id}`;
      let admin_authorization = `Bearer ${admin_token}`;

      const { data } = await axios
        .get(admin_url, {
          headers: {
            Authorization: admin_authorization,
          },
        })
        .catch((error) => {
          throw new ValidationError("Invalid Access");
        });
      // Once the authentication and authorization is performed, as a next step
      // the user needs to check if the authenticated user has strapi-super-admin code
      let isAdmin = data.data.roles.find(
        (x) => x.code === "strapi-super-admin"
      );

      // If it has the code, then the API will fetch and return the information of the
      // requested user to the admin user
      if (isAdmin.code === "strapi-super-admin") {
        let data = await getService("user").fetch({ id: id });
        if (data) {
          data = await sanitizeOutput(data, ctx);
          ctx.body = data;
        }
      } else {
        // But if the user is not admin and is requesting the details of other user
        // then it will return error.
        throw new ValidationError("Invalid Credentials");
      }
    }

    //If user is End User and is trying to access some other user by other Id
    // In this case, we don't need Id from the user as query string.
    // Becuase the current User in the Context State will have the Id
    else if (auth.strategy.name === "users-permissions") {
      if (id !== String(user.id)) {

        throw new ValidationError("Invalid Access");
      } else if (id === String(user.id)) {
        // We need to sanitize the data to ensure that secure data is truncated
        let data = await sanitizeOutput(user, ctx);
        ctx.body = data;
      }
    }
  },

  async reGenerateRoomName(ctx) {
    const { header } = ctx.request;
    if (!header || !header.authorization) {
      throw new ValidationError("Authorization Missing");
    }
    try {

      //Get User id from the token
      const { id: userId } = await getService("jwt").getToken(ctx);

      if (!userId){
        throw new ValidationError("Invalid Access");
      }

      // Get newly generated room name
      const roomName = generateRoomName();
      if (!roomName) {
        throw new ValidationError("Failed to generate room name.");
      }

      // Update user with new room name
      const updatedUser = { id: userId, roomName: roomName };
      const data = await getService("user").edit(userId, updatedUser);

      if (!data){
        // Throw error if user is not present
        throw new ValidationError("Invalid user id");
      }
      ctx.send({
        roomName,
        success: true,
      });
    } catch (error) {
      // Handle the error while generating room name
      throw new ValidationError("An error occurred while getting the room.");
    }
  }
};
