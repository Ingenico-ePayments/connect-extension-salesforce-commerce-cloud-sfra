/* eslint-disable no-param-reassign */
'use strict';

var Transaction = require('dw/system/Transaction');
var PaymentTransaction = require('dw/order/PaymentTransaction');
var ingenicoPreferences = require('*/cartridge/scripts/ingenicoPreferences');
var ingenicoPayloadHelpers = require('*/cartridge/scripts/ingenicoPayloadHelpers');

/**
 * Creates the correct paymentInstrument requested by the user.
 * @param {dw.order.Basket} basket Current user's basket
 * @param {Object} paymentInformation - the payment information
 * @param {Object} paymentProductId - id of the chosen payment product
 * @returns {Object} returns an error object
 */
function handle(basket, paymentInformation, paymentProductId) {
    var requiresApproval = ingenicoPreferences.getRequiresApproval();
    Transaction.wrap(function () {
        var paymentType = requiresApproval ? PaymentTransaction.TYPE_AUTH : PaymentTransaction.TYPE_CAPTURE;
        paymentInformation.paymentInstrument.paymentTransaction.setType(paymentType);
        if (paymentProductId === ingenicoPayloadHelpers.PAYMENT_PRODUCTS.IDEAL) {
        // store issuerId for iDEAL
            paymentInformation.paymentInstrument.custom.ingenicoIssuerId = paymentInformation.ingenicoIssuerId.value;
        }
    });
    return { error: false };
}

/**
 * Creates a payment method specific input object
 * @param {dw.order.PaymentInstrument} paymentInstrument The payment instrument
 * @param {number} paymentProductId - id of the chosen payment product
 * @returns {Object} returns an object containing payment method specific input
 */
function getPaymentMethodSpecificInput(paymentInstrument, paymentProductId) {
    if (paymentProductId === ingenicoPayloadHelpers.PAYMENT_PRODUCTS.IDEAL) {
        return {
            issuerId: paymentInstrument.custom.ingenicoIssuerId
        };
    }
    return null;
}
/**
* Creates a hosted checkout via the Ingenico API
* @param {dw.order.PaymentInstrument} paymentInstrument The payment instrument
* @param {dw.order.Order} order Order associated with the payment.
* @param {number} paymentProductId - id of the chosen payment product
*/
function authorize(paymentInstrument, order, paymentProductId) {
    var ingenicoHelpers = require('*/cartridge/scripts/ingenicoHelpers');
    var requiresApproval = ingenicoPreferences.getRequiresApproval();
    var paymentMethodSpecificInput = getPaymentMethodSpecificInput(paymentInstrument, paymentProductId);
    var requestBody = ingenicoPayloadHelpers.createRedirectPaymentMethodBody(paymentInstrument, order, requiresApproval, paymentMethodSpecificInput, paymentProductId);

    var redirectResponse = ingenicoHelpers.createPayment(requestBody);

    if (!redirectResponse.merchantAction && redirectResponse.merchantAction.actionType !== 'REDIRECT') {
        throw new Error('Unable to create a payment for order with orderNo ' + order.orderNo);
    } else {
        Transaction.wrap(function () {
            paymentInstrument.paymentTransaction.custom.ingenicoRedirect = redirectResponse.merchantAction.redirectData.redirectURL;
            paymentInstrument.paymentTransaction.custom.ingenicoRETURNMAC = redirectResponse.merchantAction.redirectData.RETURNMAC;
            paymentInstrument.paymentTransaction.custom.ingenicoMerchantReference = redirectResponse.payment.paymentOutput.references.merchantReference;
            paymentInstrument.paymentTransaction.custom.ingenicoTransactionId = redirectResponse.payment.id;
        });
    }
}

exports.handle = handle;
exports.authorize = authorize;
