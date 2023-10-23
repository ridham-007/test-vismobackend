const _ = require("lodash");
const utils = require("@strapi/utils");
const { checkout, updatePaymentIntent, validatePromocode, setupIntentForPayment, createCoupon, createCustomerPortal } = require("../stripe/controllers/stripe");
const { getService } = require("@strapi/plugin-users-permissions/server/utils");
const { getService: getAdminService } = require("@strapi/admin/server/utils");


var passwordChars =
  "0123456789abcdefghijklmnopqrstuvwxyz!@#$%^&*()ABCDEFGHIJKLMNOPQRSTUVWXYZ";

const { sanitize } = utils;
const { ValidationError, ApplicationError } = utils.errors;
const sanitizeUser = (user, ctx) => {
    const { auth } = ctx.state;
    const userSchema = strapi.getModel("plugin::users-permissions.user");

    return sanitize.contentAPI.output(user, userSchema, { auth });
};

module.exports = (strapi) => ({
    nexus: {},

    typeDefs: `
     # Input type to represent the product data
    input ProductInput {
      id: Int!
      currency: String
    }

    input PaymentInput {
        email: String
        paymentIntentId: String
        subscriptionId: String 
    }

    input CouponInput {
        name: String
        duration: String
        percentageOff: String
        amountOff: String
        currency: String
        durationInMonths: String
        maxRedemptions: String
    }

    type UsersPermissionsLoginPayload {
      jwt: String
      user: UsersPermissionsMe!
      password: String
    }

    type ClientData {
        id: String
        clientSecret: String
        subscriptionId: String
    }

    # Output type for the checkout response
    type checkoutResponse {
      data: ClientData
      success: Boolean
      message: String
    }

    # Output type for the setupIntentResponse response
    type setupIntentResponse {
      data: ClientData
      success: Boolean
      message: String
    }

    type paymentIntentResponse {
        success: Boolean
        message: String
    }

    type promocodeResponse {
        id: String
        discountPrice: Float
        couponName: String
        isValid: Boolean
    }

    type couponResponse {
        id: String
    }

    type portalResponse {
      url: String
      success: Boolean
      message: String 
    }

    extend type Mutation {

      generateUserPassword(username: String!): UsersPermissionsLoginPayload

      setupIntentForPayment(userEmail: String!): setupIntentResponse

      checkout(product: ProductInput, userEmail: String!, intentId: String!, couponCodeId: String): checkoutResponse

      updatePaymentIntent(paymentDetails: PaymentInput!): paymentIntentResponse

      validatePromocode(code: String!, totalAmount:Int!): promocodeResponse

      createCoupon(coupon: CouponInput): couponResponse

      createCustomerPortal(userEmail: String!): portalResponse
    }
  `,
    resolvers: {
        Mutation: {
            generateUserPassword: {
                description: 'Generate User Password',
                resolve: async (parent, args, context) => {
                    const params = _.assign({}, args);

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
                     return ({
                        jwt: getService("jwt").issue({ id: user.id }),
                        user: await sanitizeUser(updatedUser, context),
                        password,
                      });
                    } catch (error) {
                      console.error(error);
                    }
                  } else {
                    throw new ApplicationError("Add the username");
                  }
                },
            },
            setupIntentForPayment: {
                description: 'Setup setupIntent for payment',
                resolve: async (parent, args, context) => {
                    const params = _.assign({}, args);

                    // Call the existing setup intent function using the service
                    const setupIntentResult = await setupIntentForPayment(params);
                    return setupIntentResult;
                },
            },
            checkout: {
                description: 'Process the checkout and create a subscription session',
                resolve: async (parent, args, context) => {
                    const params = _.assign({}, args);
                    const { product, userEmail, intentId, couponCodeId } = params;

                    // Call the existing checkout function using the service
                    const checkoutResult = await checkout({ product, userEmail, intentId, couponCodeId });
                    return checkoutResult;
                },
            },
            updatePaymentIntent: {
                description: 'Process the updtaePaymentIntent',
                resolve: async (parent, args, context) => {
                    const params = _.assign({}, args);

                    // Call the existing update intent function using the service
                    const response = await updatePaymentIntent(params);
                    return response;
                },
            },
            validatePromocode: {
                description: 'Process the validate promocode',
                resolve: async (parent, args, context) => {
                    const params = _.assign({}, args);

                    // Call the existing validate promocode function using the service
                    const response = await validatePromocode(params);
                    return response;
                },
            },
            createCoupon: {
                description: 'create a Coupon',
                resolve: async (parent, args, context) => {
                    const params = _.assign({}, args);

                    // Call the existing create coupon function using the service
                    const response = await createCoupon(params);
                    return response;
                },
            },
            createCustomerPortal: {
                description: 'create customer portal for customer',
                resolve: async (parent, args, context) => {
                    const params = _.assign({}, args);

                    // Call the existing setup intent function using the service
                    const setupIntentResult = await createCustomerPortal(params);
                    return setupIntentResult;
                },
            }
        },
    },
    resolversConfig: {
        'Mutation.setupIntentForPayment': {
            auth: {
                scope: ['api::stripe.stripe.setupIntentForPayment']
            }
        },
        'Mutation.generateUserPassword': {
            auth: {
                scope: ['plugin::users-permissions.auth.generateUserPass']
            }
        },
        'Mutation.checkout': {
            auth: {
                scope: ['api::stripe.stripe.checkout']
            }
        },
        'Mutation.updatePaymentIntent': {
            auth: {
                scope: ['api::stripe.stripe.updatePaymentIntent']
            }
        },
        'Mutation.validatePromocode': {
            auth: {
                scope: ['api::stripe.stripe.validatePromocode']
            }
        },
        'Mutation.createCoupon': {
            auth: {
                scope: ['api::stripe.stripe.createCoupon']
            }
        }

    },
});
