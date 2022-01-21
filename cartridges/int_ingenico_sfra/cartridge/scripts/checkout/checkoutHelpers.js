var sfraPlaceOrder = module.superModule.placeOrder;
var sfraSendConfirmationEmail = module.superModule.sendConfirmationEmail;

/**
 * Get country code for payment based on geolocation or billing address
 * @param {Object} req - The local instance of the request object
 * @param {dw.order.Basket} currentBasket - The current basket
 * @returns {string} countryCode
 */
module.superModule.getCountryCodeForPayment = function getCountryCodeForPayment(req, currentBasket) {
    const ingenicoPreferences = require('*/cartridge/scripts/ingenicoPreferences');
    const countryCodeSetting = ingenicoPreferences.getCountryCodeSettingForPaymentValidation();
    if (countryCodeSetting === 'BILLINGADDRESS') {
        return currentBasket.billingAddress.countryCode.value;
    }
    return req.geolocation.countryCode;
};

/**
 * Validates payment
 * @param {Object} req - The local instance of the request object
 * @param {dw.order.Basket} currentBasket - The current basket
 * @returns {Object} an object that has error information
 */
module.superModule.validatePayment = function validatePayment(req, currentBasket) {
    var PaymentInstrument = require('dw/order/PaymentInstrument');
    var PaymentMgr = require('dw/order/PaymentMgr');
    var applicablePaymentCards;
    var applicablePaymentMethods;
    var creditCardPaymentMethod = PaymentMgr.getPaymentMethod(PaymentInstrument.METHOD_CREDIT_CARD);
    var paymentAmount = currentBasket.totalGrossPrice.value;
    var countryCode = module.superModule.getCountryCodeForPayment(req, currentBasket);

    var currentCustomer = req.currentCustomer.raw;
    var paymentInstruments = currentBasket.paymentInstruments;
    var result = {};

    applicablePaymentMethods = PaymentMgr.getApplicablePaymentMethods(
        currentCustomer,
        countryCode,
        paymentAmount
    );
    applicablePaymentCards = creditCardPaymentMethod.getApplicablePaymentCards(
        currentCustomer,
        countryCode,
        paymentAmount
    );

    var invalid = true;

    for (var i = 0; i < paymentInstruments.length; i++) {
        var paymentInstrument = paymentInstruments[i];

        if (PaymentInstrument.METHOD_GIFT_CERTIFICATE.equals(paymentInstrument.paymentMethod)) {
            invalid = false;
        }

        var paymentMethod = PaymentMgr.getPaymentMethod(paymentInstrument.getPaymentMethod());

        if (paymentMethod && applicablePaymentMethods.contains(paymentMethod)) {
            if (paymentMethod.paymentProcessor.ID !== 'INGENICO' && PaymentInstrument.METHOD_CREDIT_CARD.equals(paymentInstrument.paymentMethod)) {
                var card = PaymentMgr.getPaymentCard(paymentInstrument.creditCardType);

                // Checks whether payment card is still applicable.
                if (card && applicablePaymentCards.contains(card)) {
                    invalid = false;
                }
            } else {
                invalid = false;
            }
        }

        if (invalid) {
            break; // there is an invalid payment instrument
        }
    }

    result.error = invalid;
    return result;
};

/**
 * determines if a Ingenico payment is linked to the order
 * @param {dw.order.Order} order - The order object to be placed
 * @returns {boolean} is Ingenico order
 */
module.superModule.isIngenicoOrder = function isIngenicoOrder(order) {
    for (let paymentInstrument of order.paymentInstruments.toArray()) {
        if (paymentInstrument.paymentTransaction.custom.ingenicoHostedCheckoutId || paymentInstrument.paymentTransaction.custom.ingenicoTransactionId) {
            return true;
        }
    }
    return false;
};

/**
 * Attempts to place the order
 * @param {dw.order.Order} order - The order object to be placed
 * @param {Object} fraudDetectionStatus - an Object returned by the fraud detection hook
 * @param {boolean} forced - force original SFRA functionality
 * @returns {Object} an error object
 */
module.superModule.placeOrder = function placeOrder(order, fraudDetectionStatus, forced) {
    if (forced || module.superModule.isIngenicoOrder(order)) {
        return {};
    }
    return sfraPlaceOrder(order, fraudDetectionStatus);
};

/**
 * Sends a confirmation to the current user
 * @param {dw.order.Order} order - The current user's order
 * @param {string} locale - the current request's locale id
 * @param {boolean} forced - force original SFRA functionality
 * @returns {void}
 */
module.superModule.sendConfirmationEmail = function sendConfirmationEmail(order, locale, forced) {
    if (forced || module.superModule.isIngenicoOrder(order)) {
        return {};
    }
    return sfraSendConfirmationEmail(order, locale);
};

module.exports = module.superModule;
