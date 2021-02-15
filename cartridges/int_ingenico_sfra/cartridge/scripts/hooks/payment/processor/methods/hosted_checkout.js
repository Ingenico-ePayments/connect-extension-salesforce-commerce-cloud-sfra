/* eslint-disable no-param-reassign */
'use strict';

var Transaction = require('dw/system/Transaction');
var PaymentTransaction = require('dw/order/PaymentTransaction');
var ingenicoPreferences = require('*/cartridge/scripts/ingenicoPreferences');

/**
 * Creates the correct paymentInstrument requested by the user.
 * @param {dw.order.Basket} basket Current user's basket
 * @param {Object} paymentInformation - the payment information
 * @returns {Object} returns an error object
 */
function handle(basket, paymentInformation) {
    var requiresApproval = ingenicoPreferences.getRequiresApproval();
    Transaction.wrap(function () {
        var paymentType = requiresApproval ? PaymentTransaction.TYPE_AUTH : PaymentTransaction.TYPE_CAPTURE;
        paymentInformation.paymentInstrument.paymentTransaction.setType(paymentType);
    });
    return { error: false };
}

/**
* Creates a hosted checkout via the Ingenico API
* @param {dw.order.PaymentInstrument} paymentInstrument The payment instrument
* @param {dw.order.Order} order Order associated with the payment.
*/
function authorize(paymentInstrument, order) {
    var ingenicoHelpers = require('*/cartridge/scripts/ingenicoHelpers');
    var ingenicoPayloadHelpers = require('*/cartridge/scripts/ingenicoPayloadHelpers');

    var requiresApproval = ingenicoPreferences.getRequiresApproval();
    var variantId = ingenicoPreferences.getVariantId();
    var variantIdGuest = ingenicoPreferences.getVariantIdGuest();
    var customer = order.getCustomer();
    var tokens;
    if (customer != null && customer.getProfile() !== null) {
        var paymentInstruments = customer.getProfile().getWallet().getPaymentInstruments();
        tokens = paymentInstruments.toArray().filter(function (paymentInstrument) {
            return paymentInstrument.paymentMethod === 'HOSTED_CREDIT_CARD';
        }).map(function (paymentInstrument) {
            return paymentInstrument.getCreditCardToken();
        }).join(',');
    }

    var requestBody = ingenicoPayloadHelpers.createHostedCheckoutBody(paymentInstrument, order, requiresApproval, variantId, variantIdGuest, tokens);

    var checkoutResponse = ingenicoHelpers.createHostedCheckout(requestBody);

    if (!checkoutResponse.hostedCheckoutId) {
        throw new Error('Unable to create hosted checkout for order with orderNo ' + order.orderNo);
    } else {
        Transaction.wrap(function () {
            paymentInstrument.paymentTransaction.custom.ingenicoHostedCheckoutId = checkoutResponse.hostedCheckoutId;
            paymentInstrument.paymentTransaction.custom.ingenicoRedirect = 'https://payment.' + checkoutResponse.partialRedirectUrl;
            paymentInstrument.paymentTransaction.custom.ingenicoMerchantReference = checkoutResponse.merchantReference;
        });
    }
}

exports.handle = handle;
exports.authorize = authorize;
