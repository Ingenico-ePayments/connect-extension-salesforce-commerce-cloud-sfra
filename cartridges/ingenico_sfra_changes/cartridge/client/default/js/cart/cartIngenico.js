'use strict';

var ingenicoHelpers = require('../helpers/ingenicoHelpers');

const googlePayDataElementId = 'ingenico_googlepay_data';
const applePayDataElementId = 'ingenico_applepay_data';

/**
 * Get ApplePay button element
 * @return {jQuery|HTMLElement} jquery element of apple pay button
 */
function getApplePayButton() {
    return $('#apple-pay-button');
}

/**
 * Get GooglePay button element
 * @return {jQuery|HTMLElement} jquery element of google pay button
 */
function getGooglePayButton() {
    return $('#google-pay-button');
}

/**
 * Show Apple Pay button if data is valid
 * @param {Object} data express checkout data
 */
function showApplePayButtonIfPossible(data) {
    if (data.currencyCode === 'N/A') {
        getApplePayButton().trigger('ingenico:disableApplePay');
    } else {
        getApplePayButton().trigger('ingenico:enableApplePay');
    }
}

/**
 * Show Google Pay button if data is valid
 * @param {Object} data express checkout data
 */
function showGooglePayButtonIfPossible(data) {
    if (data.currencyCode === 'N/A') {
        getGooglePayButton().trigger('ingenico:disableGooglePay');
    } else {
        getGooglePayButton().trigger('ingenico:enableGooglePay');
    }
}

/**
 * Update express checkout data on the hidden elements
 * @param {Object} data express checkout data
 */
function updateExpressCheckoutData(data) {
    ingenicoHelpers.updateExpressCheckoutData(googlePayDataElementId, data);
    ingenicoHelpers.updateExpressCheckoutData(applePayDataElementId, data);
}

/**
 * Show Apple Pay and/or Google Pay button if data is valid
 * @param {Object} data express checkout data
 */
function showExpressCheckoutButtonsIfPossible(data) {
    showApplePayButtonIfPossible(data);
    showGooglePayButtonIfPossible(data);
}

module.exports = function () {
    $('body').on('cart:shippingMethodSelected', function (event, data) {
        const updatedData = {
            totalAmount: data.unformattedTotal.value,
            currencyCode: data.unformattedTotal.currencyCode,
            countryCode: data.countryCode,
            locale: data.locale
        };

        updateExpressCheckoutData(updatedData);
        showExpressCheckoutButtonsIfPossible(updatedData);
    });

    $('body').on('checkout:shippingMethodSelected', function (event, data) {
        const updatedData = {
            totalAmount: data.order.totals.unformattedTotal.value,
            currencyCode: data.order.totals.unformattedTotal.currencyCode,
            countryCode: data.order.totals.countryCode,
            locale: data.locale
        };

        updateExpressCheckoutData(updatedData);
        showExpressCheckoutButtonsIfPossible(updatedData);
    });

    $('body').on('promotion:success', function (event, data) {
        const updatedData = {
            totalAmount: data.unformattedTotal.value,
            currencyCode: data.unformattedTotal.currencyCode,
            countryCode: data.countryCode,
            locale: data.locale
        };

        updateExpressCheckoutData(updatedData);
        showExpressCheckoutButtonsIfPossible(updatedData);
    });

    $('body').on('cart:update', function (event, data) {
        let updatedCart = data.basket || data.cartModel || data;
        const updatedData = {
            totalAmount: updatedCart.unformattedTotal.value,
            currencyCode: updatedCart.unformattedTotal.currencyCode,
            countryCode: updatedCart.countryCode,
            locale: data.locale
        };

        updateExpressCheckoutData(updatedData);
        showExpressCheckoutButtonsIfPossible(updatedData);
    });
};
