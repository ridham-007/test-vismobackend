"use strict";
/**
 * A set of functions called "actions" for `stripe`
 */
const _ = require('lodash');
const jwt = require('jsonwebtoken');

module.exports = {
   async getToken(ctx) {

        let token;

        if (ctx) {
            const parts = ctx.split(/\s+/);

            if (parts[0].toLowerCase() !== 'bearer' || parts.length !== 2) {
                return null;
            }

            token = parts[1];
        } else {
            return null;
        }

        return new Promise(function (resolve, reject) {
    
            jwt.verify(token, strapi.config.get('plugin.users-permissions.jwtSecret'), {}, function (
                err,
                tokenPayload = {}
            ) {
                if (err) {
                    return reject(new Error('Invalid token.'));
                }
                resolve(tokenPayload);
            });
        });
    },
};
