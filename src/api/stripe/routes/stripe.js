module.exports = {
  routes: [
    {
      method: "POST",
      path: "/stripe/setup-intent",
      handler: "stripe.setupIntentForPayment",
      config: {
        policies: [],
        middlewares: [],
      },
    },
    {
      method: "POST",
      path: "/stripe",
      handler: "stripe.checkout",
      config: {
        policies: [],
        middlewares: [],
      },
    },
    {
      method: "POST",
      path: "/stripe/update-payment-intent",
      handler: "stripe.updatePaymentIntent",
      config: {
        policies: [],
        middlewares: [],
      },
    },
    {
      method: "POST",
      path: "/stripe/validate-promocode",
      handler: "stripe.validatePromocode",
      config: {
        policies: [],
        middlewares: [],
      },
    },
    {
      method: "POST",
      path: "/stripe/create-coupon",
      handler: "stripe.createCoupon",
      config: {
        policies: [],
        middlewares: [],
      },
    },
    {
      method: "POST",
      path: "/stripe/create-portal",
      handler: "stripe.createCustomerPortal",
      config: {
        policies: [],
        middlewares: [],
        }
    },
    {
      method: "POST",
      path: "/stripe/webhook",
      handler: "stripe.webhook",
      config: {
        policies: [],
        middlewares: [],
      },
    },
  ],
};
