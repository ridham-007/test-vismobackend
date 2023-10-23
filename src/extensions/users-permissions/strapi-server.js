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
const { getService: getAdminService } = require("@strapi/admin/server/utils");

const {
  validateRegisterBody,
  validateCallbackBody,
} = require("@strapi/plugin-users-permissions/server/controllers/validation/auth");

var passwordChars =
  "0123456789abcdefghijklmnopqrstuvwxyz!@#$%^&*()ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const { sanitize } = utils;
const { ValidationError, ApplicationError } = utils.errors;
const axios = require("axios");
const sanitizeUser = (user, ctx) => {
  const { auth } = ctx.state;
  const userSchema = strapi.getModel("plugin::users-permissions.user");

  return sanitize.contentAPI.output(user, userSchema, { auth });
};

const emailRegExp =
  /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;

const { findOne, update, reGenerateRoomName } = require("./server/controllers/user");
const { callback } = require("./server/controllers/auth");

module.exports = (plugin) => {
  plugin.controllers.user.findOne = async (ctx) => findOne(ctx);
  plugin.controllers.user.update = async (ctx) => update(ctx);
  plugin.controllers.auth.callback = async (ctx) => callback(ctx);
  plugin.controllers.user.generateRoomName = async (ctx) => reGenerateRoomName(ctx);
  plugin.controllers.auth.resetPassword = async (ctx) => {

    const params = _.assign({}, ctx.request.body, ctx.params);
    if (
      params.currentPassword &&
      params.password &&
      params.passwordConfirmation &&
      params.password === params.passwordConfirmation &&
      params.username
    ) {
      const user = await strapi
        .query("plugin::users-permissions.user")
        .findOne({ where: { userame: `${params.username}` } });

      if (!user) {
        throw new ValidationError("Incorrect username provided");
      }
      const validPassword = await strapi
        .service("plugin::users-permissions.user")
        .validatePassword(params.currentPassword, user.password);

      if (!validPassword) {
        throw new ValidationError("Wrong Current Pass");
      }
      const password = await getAdminService('auth').hashPassword(params.password);

      // Update the user.
      await strapi.query("plugin::users-permissions.user").update({
        where: { id: user.id },
        data: { resetPasswordToken: null, password },
      });

      let userOne = await strapi.service.user.findOne(user.id);

      ctx.send({
        jwt: getService("jwt").issue({ id: user.id }),
        user: await sanitizeUser(user, ctx),
      });
    } else if (
      params.password &&
      params.passwordConfirmation &&
      params.password !== params.passwordConfirmation
    ) {
      throw new ValidationError("Passwords do not match");
    } else {
      throw new ValidationError("Incorrect params provided");
    }
  };

  plugin.controllers.auth.confirmUserToken = async (ctx) => {
    const params = _.assign({}, ctx.request.body, ctx.params);
    if (params.email && params.id) {
      try {
        const user = await strapi
          .query("plugin::users-permissions.user")
          .findOne({ where: { email: `${params.email}` } });

        if (!user) {
          throw new ValidationError("Incorrect jwt provided");
        }
        const jwt = getService("jwt").issue({ id: user.id });
        if (jwt !== params.id) {
          throw new ValidationError("Incorrect jwt provided");
        }
        ctx.send({
          user: await sanitizeUser(user, ctx),
        });
      } catch (error) {
        console.error(error);
      }
    } else {
      throw new ApplicationError("Add the email");
    }
  };

  plugin.controllers.auth.generateUserPass = async (ctx) => {
    const params = _.assign({}, ctx.request.body, ctx.params);
    if (params.username) {
      try {
        const user = await strapi
          .query("plugin::users-permissions.user")
          .findOne({ where: { username: `${params.username}` } });

        if (!user) {
          throw new ValidationError("Incorrect username provided");
        }
        var passwordLength = 7;
        var password = "";
        for (var i = 0; i <= passwordLength; i++) {
          var randomNumber = Math.floor(Math.random() * passwordChars.length);
          password += passwordChars.substring(randomNumber, randomNumber + 1);
        }
        const encodedPassword = getAdminService('auth').hashPassword(password);

        const updatedUser = await strapi
          .query("plugin::users-permissions.user")
          .update({
            where: { id: user.id },
            data: { password: encodedPassword },
          });
        ctx.send({
          jwt: getService("jwt").issue({ id: user.id }),
          user: await sanitizeUser(updatedUser, ctx),
          password,
        });
      } catch (error) {
        console.error(error);
      }
    } else {
      throw new ApplicationError("Add the username");
    }
  };

  plugin.routes["content-api"].routes.push({
    method: "POST",
    path: "/users/token",
    handler: "auth.confirmUserToken",
    config: {
      policies: [],
    },
  });
  plugin.routes["content-api"].routes.push({
    method: "POST",
    path: "/users/new-pass",
    handler: "auth.generateUserPass",
    config: {
      policies: [],
    },
  });

  plugin.routes["content-api"].routes.push({
    method: 'GET',
    path: '/user/generateRoomName',
    handler: 'user.generateRoomName',
    config: {
      policies: [],
      prefix: '',
    },
  });
  return plugin;
};
