"use strict";

/**
 * Auth.js controller
 *
 * @description: A set of functions called "actions" for managing `Auth`.
 */

/* eslint-disable no-useless-escape */
const crypto = require("crypto");
const _ = require("lodash");
const utils = require("@strapi/utils");
const { getService } = require("@strapi/plugin-users-permissions/server/utils");
const {
  validateCallbackBody,
} = require("@strapi/plugin-users-permissions/server/controllers/validation/auth");

const maximum = 1000000000000000000;
const minimum = 1;
const roomLength = 20;
const ROOM_NAME_STRING = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

const { sanitize } = utils;
const { ApplicationError, ValidationError } = utils.errors;

const emailRegExp =
  /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;

const sanitizeUser = (user, ctx) => {
  const { auth } = ctx.state;
  const userSchema = strapi.getModel("plugin::users-permissions.user");

  return sanitize.contentAPI.output(user, userSchema, { auth });
};

// Generate RoomName with String Character and Digits.
// Example - Dj5ujmcxfzBP9CNw5x2E
const generateRoomName = () => {
  let result = '';
  const characters = ROOM_NAME_STRING;
  const charactersLength = characters.length;
  let counter = 0;
  while (counter < roomLength) {
    result += characters.charAt(Math.floor(Math.random() * charactersLength));
    counter += 1;
  }
  return result;
}

module.exports = {
  async callback(ctx) {
    const provider = ctx.params.provider || "local";
    const params = ctx.request.body;

    const store = await strapi.store({
      type: "plugin",
      name: "users-permissions",
    });

    if (provider === "local") {
      if (!_.get(await store.get({ key: "grant" }), "email.enabled")) {
        throw new ApplicationError("This provider is disabled");
      }

      await validateCallbackBody(params);

      const query = { provider };

      // Check if the provided identifier is an email or not.
      const isEmail = emailRegExp.test(params.identifier);

      // Set the identifier to the appropriate query field.
      if (isEmail) {
        query.email = params.identifier.toLowerCase();
      } else {
        query.username = params.identifier;
      }

      // Check if the user exists.
      const user = await strapi
        .query("plugin::users-permissions.user")
        .findOne({ where: query });

      if (!user) {
        throw new ValidationError("Invalid identifier or password");
      }

      if (
        _.get(await store.get({ key: "advanced" }), "email_confirmation") &&
        user.confirmed !== true
      ) {
        throw new ApplicationError("Your account email is not confirmed");
      }

      if (user.blocked === true) {
        throw new ApplicationError(
          "Your account has been blocked by an administrator"
        );
      }

      // The user never authenticated with the `local` provider.
      if (!user.password) {
        throw new ApplicationError(
          "This user never set a local password, please login with the provider used during account creation"
        );
      }

      const validPassword = await getService("user").validatePassword(
        params.password,
        user.password
      );

      if (!validPassword) {
        throw new ValidationError("Invalid identifier or password");
      } else {
        //Example - 12387996123
        let sessionUID = Math.floor(
          Math.random() * (maximum - minimum + 1) + minimum
        );
        //Example - Dj5ujmcxfzBP9CNw5x2E
        let roomName = generateRoomName();
        let updatedUser = { id: user.id, sessionUID: sessionUID, roomName : roomName };

        const data = await getService("user").edit(user.id, updatedUser);
        ctx.send({
          jwt: getService("jwt").issue({
            id: user.id,
          }),
          user: await sanitizeUser(data, ctx),
        });
      }
    } else {
      if (!_.get(await store.get({ key: "grant" }), [provider, "enabled"])) {
        throw new ApplicationError("This provider is disabled");
      }

      // Connect the user with the third-party provider.
      let user;
      let error;
      try {
        [user, error] = await getService("providers").connect(
          provider,
          ctx.query
        );
      } catch ([user, error]) {
        throw new ApplicationError(error.message);
      }

      if (!user) {
        throw new ApplicationError(error.message);
      }
      ctx.send({
        jwt: getService("jwt").issue({ id: user.id }),
        user: await sanitizeUser(user, ctx),
      });
    }
  },
  generateRoomName,
};
