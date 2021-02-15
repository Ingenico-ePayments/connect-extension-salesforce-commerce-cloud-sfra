/* eslint-disable no-param-reassign */
'use strict';

var Transaction = require('dw/system/Transaction');
var OrderMgr = require('dw/order/OrderMgr');
var Logger = require('dw/system/Logger');
var ingenicoPayloadHelpers = require('*/cartridge/scripts/ingenicoPayloadHelpers');
var ingenicoHelpers = require('*/cartridge/scripts/ingenicoHelpers');

/**
 * Determine the correct handler module for the given payment method
 * @param {string} paymentMethod the chosen payment method
 * @returns {Object} object containing module handler and payment product Id
 */
function getMethodHandler(paymentMethod) {
    var handler;
    var paymentProductId;
    switch (paymentMethod) {
        case 'CREDIT_CARD':
            handler = require('./methods/card_method');
            break;
        case 'HOSTED_CREDIT_CARD':
            handler = require('./methods/hosted_checkout');
            break;
        case 'IDEAL':
            handler = require('./methods/redirect_method');
            paymentProductId = 809;
            break;
        case 'TRUSTLY':
            handler = require('./methods/redirect_method');
            paymentProductId = 806;
            break;
        case 'PAYPAL':
            handler = require('./methods/redirect_method');
            paymentProductId = 840;
            break;
        default:
            throw new Error('Ingenico payment processor is not configured for paymentMethod ' + paymentMethod + '.');
    }
    return {
        methodHandler: handler,
        paymentProductId: paymentProductId
    };
}

/**
 * Creates the correct paymentInstrument requested by the user.
 * @param {dw.order.Basket} basket Current user's basket
 * @param {Object} paymentInformation - the payment information
 * @returns {Object} returns an error object
 */
function Handle(basket, paymentInformation) {
    var collections = require('*/cartridge/scripts/util/collections');

    Transaction.wrap(function () {
        collections.forEach(basket.getPaymentInstruments(), function (item) {
            basket.removePaymentInstrument(item);
        });

        paymentInformation.paymentInstrument = basket.createPaymentInstrument(
            paymentInformation.paymentMethod.value, basket.totalGrossPrice
        );
    });

    var result = { error: false };
    var handler;
    try {
        handler = getMethodHandler(paymentInformation.paymentMethod.value);
    } catch (e) {
        result.error = true;
        result.payload = 'no methodHandler found for ' + paymentInformation.paymentMethod.value;
        Logger.getLogger('Ingenico').error('PaymentMethod [{0}] not currently supported by Ingenico cartridge', paymentInformation.paymentMethod.value);
        return result;
    }

    if (handler) {
        try {
            handler.methodHandler.handle(basket, paymentInformation, handler.paymentProductId);
        } catch (e) {
            return { error: true, fieldErrors: [] };
        }
    }

    return result;
}

/**
* Authorizes a payment.
* @param {number} orderNumber - The current order's number
* @param {dw.order.PaymentInstrument} paymentInstrument -  The payment instrument to authorize
* @param {dw.order.PaymentProcessor} paymentProcessor -  The payment processor of the current
*      payment method
* @return {Object} returns an error object
*/
function Authorize(orderNumber, paymentInstrument, paymentProcessor) {
    var result = { error: false, fieldErrors: [] };
    var order = OrderMgr.getOrder(orderNumber);
    Transaction.wrap(function () {
        paymentInstrument.paymentTransaction.paymentProcessor = paymentProcessor;
    });

    var handler;
    try {
        handler = getMethodHandler(paymentInstrument.paymentMethod);
    } catch (e) {
        result.error = true;
        result.payload = 'no methodhandler found for ' + paymentInstrument.paymentMethod;
        Logger.getLogger('Ingenico').error('PaymentMethod [{0}] not currently supported by Ingenico cartridge', paymentInstrument.paymentMethod);
        return result;
    }
    try {
        handler.methodHandler.authorize(paymentInstrument, order, handler.paymentProductId);
    } catch (e) {
        result.error = true;
        result.payload = e;
        Logger.getLogger('Ingenico').error('Error communicating with Ingenico API [{0}]', e.message);
        return result;
    }

    return result;
}

/**
 * Create a token based on card details
 * @param {string} encryptedCustomerInput encrypted blob containing the card and customer details
 * @returns {string} token
 */
function createToken(encryptedCustomerInput) {
    var ingenicoHelpers = require('*/cartridge/scripts/ingenicoHelpers');
    var tokenPayload = ingenicoPayloadHelpers.createTokenBody(encryptedCustomerInput);
    var tokenResponse = ingenicoHelpers.createToken(tokenPayload);
    return tokenResponse.token;
}

/**
 * Get a token based on tokenId
 * @param {string} tokenId id of the token
 * @returns {Object} token
 */
function getToken(tokenId) {
    var tokenResponse = ingenicoHelpers.getToken(tokenId);
    return tokenResponse;
}

/**
 * Deletes a token based on tokenId
 * @param {string} tokenId id of the token
 */
function deleteToken(tokenId) {
    ingenicoHelpers.deleteToken(tokenId);
}

exports.Handle = Handle;
exports.Authorize = Authorize;
exports.createToken = createToken;
exports.getToken = getToken;
exports.deleteToken = deleteToken;
