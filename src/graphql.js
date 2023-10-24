'use strict';

const cutsomApi = require('./api/custom-api/graphql')
const extensions = [cutsomApi]

module.exports = (strapi) => {
    const extensionService = strapi.plugin('graphql').service('extension')

    for (const extension of extensions) {
        extensionService.use(extension(strapi))
    }
}

//include a new loop