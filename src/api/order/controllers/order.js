const { createCoreController } = require("@strapi/strapi").factories;
const stripe = require("stripe")(
  "sk_test_51LiyTdCac8GE50pe9HH2TEjCcAubFNTcm9a7H1z611sGugxQXgxkIk7a5daIOIZaVB3Wt83ORJuY5G8jr8248VtB00isAwqLI0"
);
module.exports = createCoreController("api::order.order", ({ strapi }) => ({
  // Method 1: Creating an entirely custom action
  // async fetchALl(ctx) {
  //   try {
  //     ctx.body = "ok";
  //   } catch (err) {
  //     ctx.body = err;
  //   }
  // },

  // Method 2: Wrapping a core action (leaves core logic in place)
  async find(ctx) {
    // some custom logic here
    ctx.query = { ...ctx.query, local: "en" };

    // Calling the default core action
    const { data, meta } = await super.find(ctx);

    // some more custom logic
    meta.date = Date.now();

    return { data, meta };
  },

  // async create(ctx) {
  //   const response = await super.create(ctx);
  //   try {
  //     const {
  //       title,
  //       price,
  //       imageId,
  //       imageUrl,
  //       description,
  //       isSubscription,
  //       paymentInterval,
  //       trialPeriodDays,
  //     } = ctx.request.body;

  //     await stripe.products.create({
  //       title,
  //       price,
  //       imageId,
  //       imageUrl,
  //       description,
  //       isSubscription,
  //       paymentInterval,
  //       trialPeriodDays,
  //     });

  //     const entity = await strapi.service("api::order.order").create({
  //       title,
  //       price,
  //       imageId,
  //       imageUrl,
  //       description,
  //       isSubscription,
  //       paymentInterval,
  //       trialPeriodDays,
  //     });
  //     const sanitizedEntity = await this.sanitizeOutput(entity, ctx);
  //     return this.transformResponse(sanitizedEntity);
  //     // 3
  //   } catch (err) {
  //     console.error(err);
  //     ctx.response.status = 500;
  //     return {
  //       error: { message: "There was a problem creating the charge" },
  //     };
  //   }
  // },
  // Method 3: Replacing a core action
  async findOne(ctx) {
    const { id } = ctx.params;
    const { query } = ctx;

    const entity = await strapi.service("api::order.order").findOne(id, query);
    const sanitizedEntity = await this.sanitizeOutput(entity, ctx);

    return this.transformResponse(sanitizedEntity);
  },
}));
