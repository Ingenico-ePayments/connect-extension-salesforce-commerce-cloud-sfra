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
        paymentInformation.paymentInstrument.custom.ingenicoEncryptedCustomerInput = paymentInformation.ingenicoEncryptedCustomerInput.value;
        paymentInformation.paymentInstrument.custom.saveCard = paymentInformation.saveCard.value;
        paymentInformation.paymentInstrument.custom.storedPaymentUUID = paymentInformation.storedPaymentUUID.value;
    });
    return { error: false };
}


/**
* Creates a hosted checkout via the Ingenico API
* @param {dw.order.PaymentInstrument} paymentInstrument The payment instrument
* @param {dw.order.Order} order Order associated with the payment.
* @param {string} encryptedCustomerInput encrypted blob containing card details
* @param {number} paymentProductId - id of the chosen payment product
*/
function authorize(paymentInstrument, order) {
    var ingenicoPayloadHelpers = require('*/cartridge/scripts/ingenicoPayloadHelpers');
    var ingenicoHelpers = require('*/cartridge/scripts/ingenicoHelpers');
    var requiresApproval = ingenicoPreferences.getRequiresApproval();
    var storedPaymentUUID = paymentInstrument.custom.storedPaymentUUID;

    // find the token based on storedPaymentUUID
    var customer = order.getCustomer();
    var token;
    var tokenize = false;
    if (customer != null && customer.getProfile() !== null) {
        var wallet = customer.getProfile().getWallet();
        var paymentInstruments = wallet.getPaymentInstruments().toArray();
        var paymentToUse = paymentInstruments.filter(function (paymentInstrument) {
            return storedPaymentUUID === paymentInstrument.UUID;
        })[0];
        if (paymentToUse) {
            token = paymentToUse.creditCardToken;
        }
        tokenize = paymentInstrument.custom.saveCard;
    }

    var requestBody = ingenicoPayloadHelpers.createCardPaymentMethodBody(paymentInstrument,
                                                                        order,
                                                                        requiresApproval,
                                                                        paymentInstrument.custom.ingenicoEncryptedCustomerInput,
                                                                        tokenize,
                                                                        token);

    var cardPaymentResponse = ingenicoHelpers.createPayment(requestBody);

    if (!cardPaymentResponse.payment) {
        throw new Error('Unable to create a payment for order with orderNo ' + order.orderNo);
    }

    if (cardPaymentResponse.merchantAction && cardPaymentResponse.merchantAction.actionType === 'REDIRECT') {
        Transaction.wrap(function () {
            paymentInstrument.paymentTransaction.custom.ingenicoRedirect = cardPaymentResponse.merchantAction.redirectData.redirectURL;
        });
    }
    Transaction.wrap(function () {
        paymentInstrument.paymentTransaction.custom.ingenicoMerchantReference = cardPaymentResponse.payment.paymentOutput.references.merchantReference;
        paymentInstrument.paymentTransaction.custom.ingenicoTransactionId = cardPaymentResponse.payment.id;
        paymentInstrument.paymentTransaction.custom.ingenicoResult = cardPaymentResponse.payment.status;
    });
}

exports.handle = handle;
exports.authorize = authorize;
