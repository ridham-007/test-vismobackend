"use strict";
const stripe = require("stripe")(process.env.STRIPE_SK);
/**
 * A set of functions called "actions" for `stripe`
 */
const utils = require("@strapi/utils");
const { ValidationError, ApplicationError } = utils.errors;
const _ = require("lodash");
const unparsed = require('koa-body/unparsed.js');

const getDateFromTimestamp = (timeStamp) => {
  const date = new Date(timeStamp * 1000);
  const formatedDate = date.toISOString().replace(/T/, ' ').replace(/\..+/, '');
  return formatedDate;
}

// Create price for the products into stripe
const createPrice = async (productId, amount, currency, productData) => {
  try {
    return await stripe.prices.create({
      product: productId,
      unit_amount: amount * 100,
      currency,
      recurring: { interval: `${productData?.time.replace('/', '')}` },
    });
  } catch (error) {
    throw new ValidationError("Error While creating price", error);
  }
};

// Create product for the products into stripe
const createProduct = async (productData) => {
  try {
    return await stripe.products.create({
      name: productData?.title,
    });
  } catch (error) {
    throw new ValidationError("Error While creating product:", error);
  }
};

const errorValidation = async (err) => {
  let error = false;
  let message = '';
  try {
    switch (err.type) {
      case 'StripeCardError':
        // A declined card error
        error = true;
        message = err.message; // => e.g. "Your card's expiration year is invalid."
        break;
      case 'StripeRateLimitError':
        // Too many requests made to the API too quickly
        error = true;
        message = err.message;
        break;
      case 'StripeInvalidRequestError':
        // Invalid parameters were supplied to Stripe's API
        error = true;
        message = err.message;
        break;
      case 'StripeAPIError':
        // An error occurred internally with Stripe's API
        error = true;
        message = err.message;
        break;
      case 'StripeConnectionError':
        // Some kind of error occurred during the HTTPS communication
        error = true;
        message = err.message;
        break;
      case 'StripeAuthenticationError':
        // You probably used an incorrect API key
        error = true;
        message = err.message;
        break;
      default:
        // Handle any other types of unexpected errors
        error = false;
        message = "No error found"
        break;
    }
  } catch (error) {
    throw new ValidationError("Error while finding error.");
  }

  return {
    error,
    message,
  }
};

// Create subscription into stripe
const createSubscription = async (customerId, priceId, trialPeriodDays, couponCodeId) => {

  if (trialPeriodDays > 0) {

    try {
      return await new Promise((resolve, reject) => {
        stripe.subscriptions.create({
          customer: customerId,
          items: [{
            price: priceId,
          }],
          trial_period_days: trialPeriodDays,
          payment_settings: {
            save_default_payment_method: 'on_subscription',
          },
          trial_settings: {
            end_behavior: {
              missing_payment_method: 'cancel',
            },
          },
          coupon: couponCodeId ? couponCodeId : '',
          payment_behavior: 'default_incomplete',
          expand: ['latest_invoice.payment_intent'],
        }, function (err, result) {
          if (err) {
            const {
              error,
              message
            } = errorValidation(err);
            if (error) {
              return {
                error,
                success: false,
                message,
              }
            }
            reject(err);
          } else {
            resolve(result);
          }
        });
      })
    } catch (error) {
      throw new ValidationError("Error While creating subscription:", error);
    }
  } else {
    try {
      return await new Promise((resolve, reject) => {
        stripe.subscriptions.create({
          customer: customerId,
          items: [{
            price: priceId,
          }],
          payment_settings: {
            save_default_payment_method: 'on_subscription',
          },
          coupon: couponCodeId ? couponCodeId : '',
          payment_behavior: 'default_incomplete',
          expand: ['latest_invoice.payment_intent'],
        }, function (err, result) {
          if (err) {
            const {
              error,
              message
            } = errorValidation(err);
            if (error) {
              return {
                error,
                success: false,
                message,
              }
            }
            reject(err);
          } else {
            resolve(result);
          }
        });
      });
    } catch (error) {
      throw new ValidationError("Error While creating subscription:", error);
    }
  }
};

const updatePaymentData = async (setupIntent, id) => {
  let error = false;
  let message = '';

  try {
    switch (setupIntent.status) {

      case "requires_payment_method":
        error = true;
        message = "Payment method is required."
        await strapi.query("api::payment.payment").update({
          where: { intentId: id },
          data: { status: setupIntent.status, updateAt: new Date() },
        });

        break;

      case "processing":
        error = true;
        message = "Payment is inprogress."
        await strapi.query("api::payment.payment").update({
          where: { intentId: id },
          data: { status: setupIntent.status, updateAt: new Date() },
        });

        break;

      case "succeeded":

        await strapi.query("api::payment.payment").update({
          where: { intentId: id },
          data: { status: setupIntent.status, updateAt: new Date() },
        });

        break;

      case "requires_action":
        error = true;
        message = "Payment method is required."
        await strapi.query("api::payment.payment").update({
          where: { intentId: id },
          data: { status: setupIntent.status, updateAt: new Date() },
        });

        break;

      case "requires_confirmation":
        error = true;
        message = "Payment method is requires_confirmation."
        await strapi.query("api::payment.payment").update({
          where: { intentId: id },
          data: { status: setupIntent.status, updateAt: new Date() },
        });

        break;

      case "canceled":
        error = true;
        message = "Payment is canceled."
        try {
          await strapi.query("api::payment.payment").update({
            where: { intentId: id },
            data: { status: setupIntent.status, updateAt: new Date() },
          });
        } catch (err) {
          console.error("cancled", err)
        }

        break;

      default:
        error = true;
        message = "Something went wrong try again."
        break;
    }
  } catch (e) {
    throw new ApplicationError('Error while updating payment.', e)
  }

  return {
    error,
    message,
  }
}

const updateSubscription = async (subscription, id) => {
  let error = false;
  let message = '';
  let subscriptionResponse;

  try {
    switch (subscription.status) {
      case "trialing":
        error = false;
        message = '';
        await strapi.query("api::order.order").update({
          where: { subscriptionId: id },
          data: {
            status: subscription.status,
            trailStart: getDateFromTimestamp(subscription.trial_start),
            trailEnd: getDateFromTimestamp(subscription.trial_end),
            canceled: subscription.cancel_at_period_end === false ? false : subscription.cancel_at_period_end,
            canceledDate: subscription.canceled_at === null ? null : getDateFromTimestamp(subscription.canceled_at),
            cancellationDetails: subscription.cancellation_details.reason === null ? subscription.cancellation_details.feedback ? subscription.cancellation_details.feedback : subscription.cancellation_details.comment : subscription.cancellation_details.feedback,
            updateAt: new Date()
          },
        });

        const product = await strapi
            .query("api::product.product")
            .findOne({ where: { productId: subscription.plan.product } });

          if (!product) {
            throw new ApplicationError("Product not found.");
          }

         try {
          const user = await strapi
            .query("plugin::users-permissions.user")
            .update({
              where: { customerID: subscription.customer },
              data: {
                activationDate: null,
                endDate: null,
                PackageType: product.title
              }
            });

          if (!user) {
            throw new ValidationError("User with the provided email not found.");
          }
        } catch (error) {
          throw new ApplicationError("Error in updation user data", error);
        }

        break;

      case "active":
        error = false;
        message = 'Subscription status is active';
        const subscriptionData = await strapi.query("api::order.order").update({
          where: { subscriptionId: id },
          data: {
            status: subscription.status,
            startDate: getDateFromTimestamp(subscription.current_period_start),
            endDate: getDateFromTimestamp(subscription.current_period_end),
            paymentIntentId: subscription.latest_invoice.payment_intent === null ? '' : subscription.latest_invoice.payment_intent.id,
            canceled: subscription.cancel_at_period_end === false ? false : subscription.cancel_at_period_end,
            canceledDate: subscription.canceled_at === null ? null : getDateFromTimestamp(subscription.canceled_at),
            cancellationDetails: subscription.cancellation_details.reason === null ? subscription.cancellation_details.feedback ? subscription.cancellation_details.feedback : subscription.cancellation_details.comment : subscription.cancellation_details.feedback,
            updateAt: new Date()
          },
        });

          const productData = await strapi
            .query("api::product.product")
            .findOne({ where: { productId: subscription.plan.product } });

          if (!productData) {
            throw new ApplicationError("Product not found.");
          }

        try {
          const user = await strapi
            .query("plugin::users-permissions.user")
            .update({
              where: { customerID: subscription.customer },
              data: {
                activationDate: getDateFromTimestamp(subscription.current_period_start),
                endDate: getDateFromTimestamp(subscription.current_period_end),
                PackageType: productData.title
              }
            });

          if (!user) {
            throw new ValidationError("User with the provided email not found.");
          }
        } catch (error) {
          throw new ApplicationError("Error in updation user data", error);
        }

        break;

      case "incomplete":
        error = true;
        message = 'Subscription status is incomplete.'
        await strapi.query("api::order.order").update({
          where: { subscriptionId: id },
          data: {
            status: subscription.status,
            user: null,
            updateAt: new Date()
          },
        });

        break;

      case "incomplete_expired":

        error = true;
        message = 'Subscription is incomplete or expired.'
        await strapi.query("api::order.order").update({
          where: { subscriptionId: id },
          data: {
            status: subscription.status,
            updateAt: new Date()
          },
        });

        break;

      case "canceled":

        error = true
        message = 'Subscription is canceled.'
        subscriptionResponse = await strapi.query("api::order.order").update({
          where: { subscriptionId: id },
          data: {
            status: subscription.status,
            canceled: true,
            canceledDate: getDateFromTimestamp(subscription.canceled_at),
            cancellationDetails: subscription.cancellation_details.reason === null ? subscription.cancellation_details.feedback ? subscription.cancellation_details.feedback : subscription.cancellation_details.comment : subscription.cancellation_details.feedback,
            updateAt: new Date(),
          },
        });

        try {
          const user = await strapi
            .query("plugin::users-permissions.user")
            .update({
              where: { customerID: subscription.customer },
              data: {
                activationDate: null,
                endDate: null,
                PackageType: null
              }
            });

          if (!user) {
            throw new ValidationError("User with the provided email not found.");
          }
        } catch (error) {
          throw new ApplicationError("Error in updation user data", error);
        }

        break;

      case "unpaid":

        error = true;
        message = 'Subscription is unpaid.'
        await strapi.query("api::order.order").update({
          where: { subscriptionId: id },
          data: {
            status: subscription.status,
            updateAt: new Date()
          },
        });

        break;

      case "incomplete_expired":

        error = true;
        message = 'Subscription is unpaid.'
        await strapi.query("api::order.order").update({
          where: { subscriptionId: id },
          data: {
            status: subscription.status,
            updateAt: new Date()
          },
        });

        break;

      default:
        error = true;
        message = 'Something went wrong.'
        break;
    }
  } catch (error) {
    throw new ApplicationError("Error while updating subscription", error);
  }

  return {
    error,
    message,
    subscriptionResponse
  }
}

const createInvoice = async (subscription) => {

  let error = false;
  let message = '';

  try {
    switch (subscription.latest_invoice.status) {

      case "draft":
        error = true;
        message = "Invoice is not generated."

        break;

      case "open":
        error = true;
        message = "Invoice is inprogress."

        break;

      case "paid":

        await strapi.service("api::invoice.invoice").create({
          data: {
            invoiceId: subscription.latest_invoice.id,
            customerId: subscription.latest_invoice.customer,
            invoiceLink: subscription.latest_invoice.hosted_invoice_url,
            status: subscription.latest_invoice.status,
            subscriptionId: subscription.latest_invoice.subscription,
            amount: 0.01 * subscription.latest_invoice.amount_paid
          },
        });

        break;

      case "uncollectible":
        error = true;
        message = "Payment not done."

        break;

      case "void":
        error = true;
        message = "Subscription is canceled."

        break;

      default:
        error = true;
        message = "Something went wrong try again."
        break;
    }
  } catch (e) {
    throw new ApplicationError('Error while creating invoice.', e)
  }

  return {
    error,
    message,
  }
}

const updateInvoice = async (invoice) => {

  let error = false;
  let message = '';

  try {
    switch (invoice.status) {

      case "draft":
        error = true;
        message = "Invoice is not generated."

        await strapi.query("api::invoice.invoice").update({
          where: { invoiceId: invoice.id },
          data: {
            invoiceLink: invoice.hosted_invoice_url,
            status: invoice.status,
            amount: 0.01 * invoice.amount_paid
          },
        });

        break;

      case "open":
        error = true;
        message = "Invoice is inprogress."

        await strapi.query("api::invoice.invoice").update({
          where: { invoiceId: invoice.id },
          data: {
            invoiceLink: invoice.hosted_invoice_url,
            status: invoice.status,
            amount: 0.01 * invoice.amount_paid
          },
        });

        break;

      case "paid":

        await strapi.query("api::invoice.invoice").update({
          where: { invoiceId: invoice.id },
          data: {
            invoiceLink: invoice.hosted_invoice_url,
            status: invoice.status,
            amount: 0.01 * invoice.amount_paid
          },
        });

        break;

      case "uncollectible":
        error = true;
        message = "Payment not done."

        await strapi.query("api::invoice.invoice").update({
          where: { invoiceId: invoice.id },
          data: {
            invoiceLink: invoice.hosted_invoice_url,
            status: invoice.status,
            amount: 0.01 * invoice.amount_paid
          },
        });

        break;

      case "void":
        error = true;
        message = "Subscription is canceled."

        await strapi.query("api::invoice.invoice").update({
          where: { invoiceId: invoice.id },
          data: {
            invoiceLink: invoice.hosted_invoice_url,
            status: invoice.status,
            amount: 0.01 * invoice.amount_paid
          },
        });

        break;

      default:
        error = true;
        message = "Something went wrong try again."
        break;
    }
  } catch (error) {
    throw new ApplicationError('Error while creating invoice.', error)
  }

  return {
    error,
    message,
  }
}

const valdatethSetupIntent = async (setupIntent) => {
  let message = '';
  switch (setupIntent.last_setup_error.type) {
    case "api_error":
      message = setupIntent.last_setup_error.message;
      break;
    case "card_error":
      message = setupIntent.last_setup_error.message;
      break;
    case "idempotency_error":
      message = setupIntent.last_setup_error.message;
      break;
    case "invalid_request_error":
      message = setupIntent.last_setup_error.message;
      break;
    default:
      message = 'Something went wrong.'
      break;
  }

  return { message };
}

const calculateDiscount = (coupon, totalAmount) => {
  if (coupon.percent_off) {
    return (coupon.percent_off / 100) * totalAmount;
  } else if (coupon.amount_off) {
    return coupon.amount_off;
  } else {
    return 0;
  }
};

module.exports = {

  setupIntentForPayment: async (ctx, next) => {

    const { userEmail } = ctx;

    try {
      // Validate if the user exists
      const user = await strapi
        .query("plugin::users-permissions.user")
        .findOne({ where: { email: `${userEmail}` } });

      if (!user) {
        throw new ValidationError("User with the provided email not found.");
      }

      // Create or retrieve customer
      let customerID;
      let shouldUpdate = false;
      if (user?.customerID) {
        customerID = user?.customerID;
      } else {
        const customer = await stripe.customers.create({
          name: user.FirstName,
          email: userEmail,
        });
        shouldUpdate = true;
        customerID = customer.id;
      }

      //setup intent from Payment Method
      let setupIntent;

      try {
        await new Promise((resolve, reject) => {
          stripe.setupIntents.create({
            automatic_payment_methods: { enabled: true },
            customer: customerID,
          }, function (err, result) {
            if (err) {
              const {
                error,
                message
              } = errorValidation(err);
              if (error) {
                return {
                  error,
                  success: false,
                  message,
                }
              }
              reject(err);
            } else {
              setupIntent = result;
              resolve();
            }
          });
        });

        if (shouldUpdate) {
          await strapi.query("plugin::users-permissions.user").update({
            where: { id: user.id },
            data: { customerID },
          });
        }

        //send success Response
        return {
          success: true,
          message: "SetupIntent successful.",
          data: {
            id: setupIntent.id,
            clientSecret: setupIntent.client_secret,
          },
        };
      } catch (error) {
        console.error("SetupIntent error:", error);
        throw new ApplicationError('Error while creating setup intent');
      }
    } catch (error) {
      // Send error response
      return {
        success: false,
        message: "An error occurred during setupIntent.",
        error: error.message,
      };
    }
  },

  checkout: async (ctx, next) => {

    const { product, userEmail, intentId, couponCodeId } = ctx;

    try {

      // Validate if the user exists
      const user = await strapi
        .query("plugin::users-permissions.user")
        .findOne({ where: { email: `${userEmail}` } });
      if (!user) {
        throw new ValidationError("User with the provided email not found.");
      }

      // Retrieve product data
      const productData = await strapi
        .query("api::product.product")
        .findOne({ where: { id: product.id } });

      if (!productData) {
        throw new ApplicationError("Product not found.");
      }

      // Retrieve currency data
      const currencyData = await strapi
        .query("api::currency.currency")
        .findOne({ where: { code: product.currency } });

      if (!currencyData) {
        throw new ApplicationError("Currency not found.");
      }

      // Calculate product amount based on currency
      let productAmount;
      if (currencyData?.code === "eur") {
        productAmount = Number(productData?.price?.replace(/\D/g, ""));
      } else {
        productAmount = productData?.price?.replace(/\D/g, "") / currencyData?.rate;
      }

      // Create or retrieve product and price
      let productId = productData?.productId;
      let priceId = productData?.priceId;

      if (!productId) {

        const newProduct = await createProduct(productData);
        productId = newProduct?.id;

        const priceDetails = await createPrice(productId, productAmount, 'eur', productData);
        priceId = priceDetails?.id;

        try {
          await strapi
            .query("api::product.product")
            .update({
              where: { id: productData.id },
              data: { productId: productId, priceId: priceId },
            });
        } catch (error) {
          throw new ValidationError('Error updating product data');
        }

      }
      //retrive set
      let setupIntent;
      try {
        setupIntent = await stripe.setupIntents.retrieve(intentId);
      } catch (error) {
        throw new ApplicationError('Error while retrieving setup intent');
      }

      // Need to get this from env
      let trialPeriodDays = productData?.trial_days;

      // Create or retrieve Subscription 
      const subscription = await createSubscription(setupIntent.customer, priceId, trialPeriodDays, couponCodeId);

      // Validate the setup intent
      if (setupIntent.last_setup_error) {
        valdatethSetupIntent(setupIntent)
      }

      //Create a new payment record
      const {
        id,
        status,
      } = setupIntent;

      const { amount_paid, currency } = subscription.latest_invoice;


      const newPayment = {
        status,
        intentId: id,
        amount: 0.01 * amount_paid,
        customerId: setupIntent.customer,
        mode: setupIntent.payment_method_types[0],
        currencyType: currency,
        createAt: new Date(),
      }

      try {
        await strapi.service("api::payment.payment").create({ data: newPayment });
      } catch (e) {
        throw new ValidationError("Error creating payment record:");
      }

      //Create a New Order record

      try {
        await strapi.service("api::order.order").create({
          data: {
            title: productData?.title,
            price: productAmount,
            status: subscription.status,
            paymentInterval: subscription.plan.interval,
            createAt: new Date(),
            productId: productData?.productId,
            subscriptionId: subscription.id,
            user: user,
            setupIntentId: id,
            trialPeriodDays: trialPeriodDays
          }
        });
      } catch (e) {
        throw new ValidationError("Error creating order record:");
      }

      // Send success response
      return {
        success: true,
        message: "Checkout successful.",
        data: {
          subscriptionId: subscription.id,
          clientSecret: subscription.latest_invoice.payment_intent === null ? null : subscription.latest_invoice.payment_intent.client_secret,
        },
      };

    } catch (error) {
      console.error("Checkout error:", error);

      // Send error response
      return {
        success: false,
        message: "An error occurred during checkout.",
        error: error.message,
      };
    }
  },

  updatePaymentIntent: async (ctx) => {
    const {
      paymentDetails: {
        email,
        paymentIntentId,
        subscriptionId
      },
    } = ctx;

    const subscription = await stripe.subscriptions.retrieve(subscriptionId, { expand: ['latest_invoice.payment_intent'] });

    let setupIntent = null
    let paymentIntent = null
    if (paymentIntentId.startsWith("seti_")) {
      setupIntent = await stripe.setupIntents.retrieve(paymentIntentId);

      const {
        error,
        message
      } = await updatePaymentData(setupIntent, paymentIntentId);

      if (error) {
        return {
          error,
          success: false,
          message,
        }
      }
    } else {
      paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

      const {
        error,
        message
      } = await updatePaymentData(paymentIntent, paymentIntentId);

      if (error) {
        return {
          error,
          success: false,
          message,
        }
      }
    }

    const {
      error: subcriptionError,
      message: errorMessage,
    } = await updateSubscription(subscription, subscriptionId);

    if (subcriptionError) {
      return {
        error: subcriptionError,
        success: false,
        message: errorMessage,
      }
    }

    const invoice = await strapi.query("api::invoice.invoice").findOne({
      where: { invoiceId: subscription.latest_invoice.id },
    });

    if (invoice === null) {

      const {
        error: invoiceError,
        message: invoiceMessage
      } = await createInvoice(subscription);

      if (invoiceError) {
        return {
          error: invoiceError,
          success: false,
          message: invoiceMessage,
        }
      }
    } else {

      try {
        await updateInvoice(subscription.latest_invoice);
      } catch (error) {
        throw new ValidationError("Error update invoice record:", error);
      }
    }

    await stripe.customers.update(
      subscription.latest_invoice.customer,
      {
        invoice_settings: {
          default_payment_method: setupIntent === null ? paymentIntent.payment_method.id : setupIntent.payment_method,
        },
      }
    );

    let userData
    try {
      userData = await strapi.query("plugin::users-permissions.user").findOne({ where: { email: email }, populate: ['premiums'], });
    } catch (error) {
      throw new ValidationError("user not Find:", error);
    }
    const shouldUpdateStatus = userData?.premiums?.find(cur => ['trialing', 'active'].includes(cur.status));
    if (userData?.premiums?.length > 1 && shouldUpdateStatus && shouldUpdateStatus?.subscriptionId !== subscriptionId) {
      try {
       await stripe.subscriptions.cancel(shouldUpdateStatus?.subscriptionId);
      } catch (error) {
        throw new ValidationError("Error in canceling subscription:", error);
      }
    }
    return {
      success: true,
    }
  },

  validatePromocode: async (ctx, next) => {
    const { code, totalAmount } = ctx;

    try {

      let couponData
      try {
        couponData = await strapi
          .query("api::promocode.promocode")
          .findOne({
            where: { name: code }
          });
      } catch (error) {
        throw new ValidationError('Error while updating coupon data');
      }

      const coupon = await stripe.coupons.retrieve(couponData?.couponId);

      const discount = calculateDiscount(coupon, totalAmount)

      if (coupon) {

        try {
          await strapi
            .query("api::promocode.promocode")
            .update({
              where: { couponId: coupon.id },
              data: {
                valid: coupon.valid,
              },
            });
        } catch (error) {
          throw new ValidationError('Error while updating coupon data');
        }

        return { id: coupon.id, couponName: coupon.name, discountPrice: discount, isValid: coupon.valid }
      }

    } catch (error) {
      console.error("promocode error:", error);
    }
  },

  createCoupon: async (ctx, next) => {

    const { name, duration, amountOff, percentageOff, currency, durationInMonths, maxRedemptions } = ctx.coupon;

    if (percentageOff && duration === 'repeating' && maxRedemptions) {

      try {
        const coupon = await stripe.coupons.create({
          percent_off: percentageOff,
          duration: duration,
          duration_in_months: durationInMonths,
          max_redemptions: maxRedemptions,
          name: name,
        });

        if (coupon) {

          let promotionCode

          try {
            promotionCode = await stripe.promotionCodes.create({
              coupon: coupon.id,
              code: coupon.name
            });
          } catch (error) {
            throw new ApplicationError('Error while creating promocode', error);
          }

          try {
            await strapi
              .service("api::promocode.promocode")
              .create({
                data: {
                  name: coupon.name,
                  percent_off: String(coupon.percent_off),
                  duration: coupon.duration,
                  duration_in_months: String(coupon.duration_in_months),
                  couponId: coupon.id,
                  valid: coupon.valid,
                  max_redemptions: String(coupon.max_redemptions)
                },
              });
          } catch (error) {
            throw new ValidationError('Error creating coupon data', error);
          }

        } else {
          throw new ApplicationError("Coupon not created.")
        }

        return { id: coupon.id }

      } catch (error) {
        throw new ApplicationError(error);
      }
    } else if (percentageOff && duration === 'repeating') {
      try {
        const coupon = await stripe.coupons.create({
          percent_off: percentageOff,
          duration: duration,
          name: name,
          duration_in_months: durationInMonths,
        });

        if (coupon) {

          let promotionCode

          try {
            promotionCode = await stripe.promotionCodes.create({
              coupon: coupon.id,
              code: coupon.name
            });
          } catch (error) {
            throw new ApplicationError('Error while creating promocode', error);
          }

          try {
            await strapi
              .service("api::promocode.promocode")
              .create({
                data: {
                  name: coupon.name,
                  percent_off: String(coupon.percent_off),
                  duration: coupon.duration,
                  duration_in_months: String(coupon.duration_in_months),
                  couponId: coupon.id,
                  valid: coupon.valid,
                },
              });
          } catch (error) {
            throw new ValidationError('Error creating coupon data', error);
          }

        } else {
          throw new ApplicationError("Coupon not created.")
        }

        return { id: coupon.id }
      } catch (error) {
        throw new ApplicationError(error);
      }

    } else if (percentageOff && maxRedemptions) {
      try {
        const coupon = await stripe.coupons.create({
          percent_off: percentageOff,
          duration: duration,
          name: name,
          max_redemptions: maxRedemptions

        });

        if (coupon) {

          let promotionCode

          try {
            promotionCode = await stripe.promotionCodes.create({
              coupon: coupon.id,
              code: coupon.name
            });
          } catch (error) {
            throw new ApplicationError('Error while creating promocode', error);
          }

          try {
            await strapi
              .service("api::promocode.promocode")
              .create({
                data: {
                  name: coupon.name,
                  percent_off: String(coupon.percent_off),
                  duration: coupon.duration,
                  duration_in_months: String(coupon.duration_in_months),
                  couponId: coupon.id,
                  valid: coupon.valid,
                  max_redemptions: String(coupon.max_redemptions)
                },
              });
          } catch (error) {
            throw new ValidationError('Error creating coupon data', error);
          }

        } else {
          throw new ApplicationError("Coupon not created.")
        }

        return { id: coupon.id }

      } catch (error) {
        throw new ApplicationError(error);
      }

    } else if (percentageOff) {
      try {
        const coupon = await stripe.coupons.create({
          percent_off: percentageOff,
          duration: duration,
          name: name,
        });

        if (coupon) {

          let promotionCode

          try {
            promotionCode = await stripe.promotionCodes.create({
              coupon: coupon.id,
              code: coupon.name
            });
          } catch (error) {
            throw new ApplicationError('Error while creating promocode', error);
          }

          try {
            await strapi
              .service("api::promocode.promocode")
              .create({
                data: {
                  name: coupon.name,
                  percent_off: String(coupon.percent_off),
                  duration: coupon.duration,
                  duration_in_months: String(coupon.duration_in_months),
                  couponId: coupon.id,
                  valid: coupon.valid,
                },
              });
          } catch (error) {
            throw new ValidationError('Error creating coupon data', error);
          }

        } else {
          throw new ApplicationError("Coupon not created.")
        }

        return { id: coupon.id }

      } catch (error) {
        throw new ApplicationError(error);
      }

    } else if (amountOff && duration === 'repeating' && maxRedemptions) {
      try {
        const coupon = await stripe.coupons.create({
          duration: duration,
          amount_off: amountOff * 100,
          name: name,
          currency: currency,
          duration_in_months: durationInMonths,
          max_redemptions: maxRedemptions
        });

        if (coupon) {

          let promotionCode

          try {
            promotionCode = await stripe.promotionCodes.create({
              coupon: coupon.id,
              code: coupon.name
            });
          } catch (error) {
            throw new ApplicationError('Error while creating promocode', error);
          }

          try {
            await strapi
              .service("api::promocode.promocode")
              .create({
                data: {
                  name: coupon.name,
                  duration: coupon.duration,
                  couponId: coupon.id,
                  valid: coupon.valid,
                  amount_off: String(coupon.amount_off),
                  currency: coupon.currency,
                  duration_in_months: String(coupon.duration_in_months),
                  max_redemptions: String(coupon.max_redemptions)
                },
              });
          } catch (error) {
            throw new ValidationError('Error creating coupon data', error);
          }

        } else {
          throw new ApplicationError("Coupon not created.")
        }

        return { id: coupon.id }
      } catch (error) {
        throw new ApplicationError(error);
      }
    } else if (amountOff && maxRedemptions) {
      try {
        const coupon = await stripe.coupons.create({
          duration: duration,
          amount_off: amountOff * 100,
          name: name,
          currency: currency,
          max_redemptions: maxRedemptions
        });

        if (coupon) {

          let promotionCode

          try {
            promotionCode = await stripe.promotionCodes.create({
              coupon: coupon.id,
              code: coupon.name
            });
          } catch (error) {
            throw new ApplicationError('Error while creating promocode', error);
          }

          try {
            await strapi
              .service("api::promocode.promocode")
              .create({
                data: {
                  name: coupon.name,
                  duration: coupon.duration,
                  couponId: coupon.id,
                  valid: coupon.valid,
                  amount_off: String(coupon.amount_off),
                  currency: coupon.currency,
                  max_redemptions: String(coupon.max_redemptions)
                },
              });
          } catch (error) {
            throw new ValidationError('Error creating coupon data', error);
          }

        } else {
          throw new ApplicationError("Coupon not created.")
        }

        return { id: coupon.id }
      } catch (error) {
        throw new ApplicationError(error);
      }
    } else if (amountOff) {
      try {
        const coupon = await stripe.coupons.create({
          duration: duration,
          amount_off: amountOff * 100,
          name: name,
          currency: currency,
        });

        if (coupon) {

          try {
            await stripe.promotionCodes.create({
              coupon: coupon.id,
              code: coupon.name
            });
          } catch (error) {
            throw new ApplicationError('Error while creating promocode', error);
          }

          try {
            await strapi
              .service("api::promocode.promocode")
              .create({
                data: {
                  name: coupon.name,
                  duration: coupon.duration,
                  couponId: coupon.id,
                  valid: coupon.valid,
                  amount_off: String(coupon.amount_off),
                  currency: coupon.currency,
                },
              });
          } catch (error) {
            throw new ValidationError('Error creating coupon data', error);
          }

        } else {
          throw new ApplicationError("Coupon not created.")
        }

        return { id: coupon.id }
      } catch (error) {
        throw new ApplicationError(error);
      }
    }
  },

  createCustomerPortal: async (ctx, next) => {

    const { userEmail } = ctx;

    try {
      // Validate if the user exists
      const user = await strapi
        .query("plugin::users-permissions.user")
        .findOne({ where: { email: `${userEmail}` } });

      if (!user) {
        throw new ValidationError("User with the provided email not found.");
      }
      // Will be updated from env once feature complete
      const customerPortal = await stripe.billingPortal.sessions.create({
        customer: user.customerID,
        return_url: process.env.CUSTOMER_PORTAL_RETURN_URL,
      });

      return {
        success: true,
        message: "CreatePortal successful.",
        url: customerPortal.url,
      };

    } catch (error) {
      console.error("customerPortal error:", error);

      // Send error response
      return {
        success: false,
        message: "An error occurred during createPortal.",
        error: error.message,
      };
    }

  },

  webhook: async (ctx, next) => {

    const secret = process.env.STRIPE_WEBHOOK_SECRET;
    const sig = ctx.request.headers['stripe-signature'];

    let event

    try {
      event = stripe.webhooks.constructEvent(ctx.request.body[unparsed], sig, secret)
    } catch (err) {
      console.error('Webhook Error:', err.message);
    }
    // Handle the event
    switch (event.type) {

      case 'customer.subscription.trial_will_end':
        const subscription = event.data.object;
        // Then define and call a function to handle the event payment_intent.succeeded
        const trialDate = subscription.trial_end;

        const trialEndDate = new Date(trialDate * 1000).toISOString().slice(0, 19); // Convert seconds to milliseconds
        const currentDate = new Date().toISOString().slice(0, 19);

        if (trialEndDate === currentDate) {

          const subscriptionUpdate = await stripe.subscriptions.update(subscription.id,
            {
              payment_behavior: 'default_incomplete',
              expand: ['latest_invoice.payment_intent'],
              trial_end: 'now'
            }
          );

          const newPayment = {
            status: subscriptionUpdate.latest_invoice.payment_intent.status,
            intentId: subscriptionUpdate.latest_invoice.payment_intent.id,
            amount: 0.01 * subscriptionUpdate.latest_invoice.payment_intent.amount,
            customerId: subscriptionUpdate.latest_invoice.payment_intent.customer,
            mode: subscriptionUpdate.latest_invoice.payment_intent.payment_method_types[0],
            currencyType: subscriptionUpdate.latest_invoice.payment_intent.currency,
            createAt: new Date(),
          }

          try {
            await strapi.service("api::payment.payment").create({ data: newPayment });
          } catch (e) {
            throw new ValidationError("Error creating payment record:");
          }

           await updateSubscription(subscription, subscription.id)

        }

        break;

      case 'payment_intent.created':
        const paymentIntentCreated = event.data.object;

        const payment = await strapi.query("api::payment.payment").findOne({
          where: { intentId: paymentIntentCreated.id },
        });

        if (payment === null) {

          const newPayment = {
            status: paymentIntentCreated.status,
            intentId: paymentIntentCreated.id,
            amount: 0.01 * paymentIntentCreated.amount,
            customerId: paymentIntentCreated.customer,
            mode: paymentIntentCreated.payment_method_types[0],
            currencyType: paymentIntentCreated.currency,
            createAt: new Date(),
          }

          try {
            await strapi.service("api::payment.payment").create({ data: newPayment });
          } catch (error) {
            throw new ValidationError("Error creating payment record:", error);
          }

        } else {

          try {
            await updatePaymentData(paymentIntentCreated, paymentIntentCreated.id);
          } catch (error) {
            throw new ValidationError("Error update paymentIntent record:", error);
          }
        }

        break;

      case 'payment_intent.requires_action':
        const paymentIntentRequires = event.data.object;

        try {
          await updatePaymentData(paymentIntentRequires, paymentIntentRequires.id);
        } catch (error) {
          throw new ValidationError("Error update paymentIntent record:", error);
        }

        break;

      case 'payment_intent.succeeded':
        const paymentIntentSucceeded = event.data.object;

        try {
          await updatePaymentData(paymentIntentSucceeded, paymentIntentSucceeded.id);
        } catch (error) {
          throw new ValidationError("Error update paymentIntent record:", error);
        }

        break;

      case 'payment_intent.canceled':
        const paymentIntentCanceled = event.data.object;

        try {
          await updatePaymentData(paymentIntentCanceled, paymentIntentCanceled.id);
        } catch (error) {
          throw new ValidationError("Error update paymentIntent record:", error);
        }

        break;

      case 'invoice.payment_failed':
        const invoicePaymentFailed = event.data.object;

        try {
          await updateInvoice(invoicePaymentFailed);
        } catch (error) {
          throw new ValidationError("Error update invoice record:", error);
        }

        break;

      case 'invoice.created':
        const invoiceCreated = event.data.object;
        // Then define and call a function to handle the event setup_intent.created

        const invoice = await strapi.query("api::invoice.invoice").findOne({
          where: { invoiceId: invoiceCreated.id },
        });

        if (invoice === null) {

          const newInvoice = {
            invoiceId: invoiceCreated.id,
            customerId: invoiceCreated.customer,
            invoiceLink: invoiceCreated.hosted_invoice_url,
            status: invoiceCreated.status,
            subscriptionId: invoiceCreated.subscription,
            amount: 0.01 * invoiceCreated.amount_paid
          }

          try {
            await strapi.service("api::invoice.invoice").create({ data: newInvoice });
          } catch (error) {
            throw new ValidationError("Error creating invoice record:", error);
          }
        } else {
          try {
            await updateInvoice(invoiceCreated);
          } catch (error) {
            throw new ValidationError("Error update invoice record:", error);
          }
        }
        break;

      case 'invoice.finalized':
        const invoiceFinalized = event.data.object;

        try {
          await updateInvoice(invoiceFinalized);
        } catch (error) {
          throw new ValidationError("Error update invoice record:", error);
        }

        break;

      case 'invoice.payment_action_required':
        const invoicePaymentRequired = event.data.object;
        try {
          await updateInvoice(invoicePaymentRequired);
        } catch (error) {
          throw new ValidationError("Error update invoice record:", error);
        }

        break;

      case 'invoice.updated':
        const invoiceUpdated = event.data.object;
        // Then define and call a function to handle the event setup_intent.created

        try {
          await updateInvoice(invoiceUpdated);
        } catch (error) {
          throw new ValidationError("Error update invoice record:", error);
        }

        break;

      case 'invoice.paid':
        const invoicePaid = event.data.object;
        // Then define and call a function to handle the event setup_intent.created
        try {
          await updateInvoice(invoicePaid);
        } catch (error) {
          throw new ValidationError("Error update invoice record:", error);
        }

        break;

      case 'invoice.payment_succeeded':
        const invoiceSuccess = event.data.object;
        // Then define and call a function to handle the event setup_intent.created
        try {
          await updateInvoice(invoiceSuccess);
        } catch (error) {
          throw new ValidationError("Error update invoice record:", error);
        }

        break;

      case 'invoice.voided':
        const invoiceVoided = event.data.object;
        // Then define and call a function to handle the event setup_intent.created
        try {
          await updateInvoice(invoiceVoided);
        } catch (error) {
          throw new ValidationError("Error update invoice record:", error);
        }

        break;

      case 'invoice.sent':
        const invoiceSent = event.data.object;
        // Then define and call a function to handle the event invoice.sent
        break;
        
      case 'invoice.upcoming':
        const invoiceUpcoming = event.data.object;
        // Then define and call a function to handle the event invoice.sent
        break;

      case 'customer.subscription.updated':
        const subcriptionUpdated = event.data.object;
        // Then define and call a function to handle the event customer.subscription.updated
        if (subcriptionUpdated.status === 'active' && subcriptionUpdated.cancel_at_period_end === true) {
          try {
            await updateSubscription(subcriptionUpdated, subcriptionUpdated.id)
          } catch (error) {
            throw new ValidationError("Error update subscription record:", error);
          }
        }

        if (subcriptionUpdated.status === 'trialing' && subcriptionUpdated.cancel_at_period_end === true) {
          try {
            await updateSubscription(subcriptionUpdated, subcriptionUpdated.id)
          } catch (error) {
            throw new ValidationError("Error update subscription record:", error);
          }
        }

        if (subcriptionUpdated.status === 'active') {
          const subscriptionUpdate = await stripe.subscriptions.retrieve(subcriptionUpdated.id,
            { expand: ['latest_invoice.payment_intent'] },
          );

          if (subscriptionUpdate.latest_invoice.payment_intent) {
            let payment
            try {
              payment = await strapi.query("api::payment.payment").findOne({
                where: { intentId: subscriptionUpdate.latest_invoice.payment_intent.id },
              });
            } catch (error) {
              throw new ValidationError("Error Find the paymentIntent:", error);
            }

            if (payment) {

              try {
                await updatePaymentData(subscriptionUpdate.latest_invoice.payment_intent, subscriptionUpdate.latest_invoice.payment_intent.id, subscriptionUpdate);
              } catch (error) {
                throw new ValidationError("Error update paymentIntent record:", error);
              }
            }
          }

          try {
            await updateSubscription(subscriptionUpdate, subscriptionUpdate.id)
          } catch (error) {
            throw new ValidationError("Error update subscription record:", error);
          }
        }

        if (subcriptionUpdated.status === 'canceled') {

          try {
            await updateSubscription(subcriptionUpdated, subcriptionUpdated.id)
          } catch (error) {
            throw new ValidationError("Error update subscription record:", error);
          }
        }

        break;

      case 'customer.subscription.deleted':

        const subcriptionDeleted = event.data.object;


        try {
          await updateSubscription(subcriptionDeleted, subcriptionDeleted.id)
        } catch (error) {
          throw new ValidationError("Error update subscription record:", error);
        }

        break;

      case 'customer.subscription.created':
        const SubscriptionCreated = event.data.object;
        const sub = await stripe.subscriptions.retrieve(SubscriptionCreated.id,
          { expand: ['latest_invoice.payment_intent'] },
        );
        break;

        case 'billing_portal.session.created':
          const billingPortalSessionCreated = event.data.object;
          // Then define and call a function to handle the event billing_portal.session.created
          break;
          
      default:
        console.error(`Unhandled event type ${event.type}`);
    }

    ctx.send({ received: true });
  }
};
