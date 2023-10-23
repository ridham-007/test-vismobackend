'use strict';

const graphql = require('./graphql')

module.exports = {

    register({ strapi }) {
        graphql(strapi) // externalize all graphql related code to ./src/graphql.js
    },

    bootstrap(/*{ strapi }*/) { },
}