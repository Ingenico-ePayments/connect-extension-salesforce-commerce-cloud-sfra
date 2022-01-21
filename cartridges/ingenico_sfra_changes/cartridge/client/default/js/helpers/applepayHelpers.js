'use strict';
const checkoutHelpers = require('./checkoutHelpers');

/**
 * Get the checkout data for Apple Pay that is stored on hidden input element
 * @return {Object} data for apple pay payment
 */
function getApplePayCheckoutData() {
    const applepayData = document.getElementById('ingenico_applepay_data').value;
    return applepayData ? JSON.parse(applepayData) : {};
}

/**
 * Set requiredBillingContactFields and requiredShippingContactFields to the payment request
 * @param {Object} paymentRequest apple pay payment request
 */
function requireBillingAndShippingInfo(paymentRequest) {
    paymentRequest.requiredBillingContactFields = ['postalAddress', 'name', 'email', 'phone'];
    paymentRequest.requiredShippingContactFields = ['postalAddress', 'name', 'email', 'phone'];
}

/**
 * Calculate the amount including tax and shipping cost
 * @param {number} totalAmount total amount of the order
 * @param {number} shippingAmount amount of the shipping costs
 * @param {number} taxRate tax rate if applicable
 * @returns {number} total order amount including tax and shipping costs
 */
function calculateAmountWithShippingCost(totalAmount, shippingAmount, taxRate) {
    // compute the amount including tax and shipping option
    let amount = parseFloat(totalAmount) + parseFloat(shippingAmount);
    if (taxRate) {
        const orderAmountTax = totalAmount * taxRate;
        const shippingCostTax = shippingAmount * taxRate;
        amount += orderAmountTax + shippingCostTax;
    }
    return amount;
}

/**
 * Get a list of shipping options for Apple Pay
 * @return {{description: *, id: *, label: *, amount: number}[]} a list of shipping options
 */
function getApplePayShippingOptions() {
    const checkoutData = getApplePayCheckoutData();
    return checkoutData.shippingMethodOptions.map(item => ({
        identifier: item.identifier,
        label: item.label,
        detail: item.detail,
        amount: item.amount
    }));
}

/**
 * Add shipping method options to payment request
 * @param {Object} paymentRequest apple pay payment request
 * @param {Object} checkoutData data for creating apple pay payment
 */
function requireShippingOptions(paymentRequest, checkoutData) {
    paymentRequest.shippingMethods = getApplePayShippingOptions();
    if (paymentRequest.shippingMethods.length > 0) {
        let amount = calculateAmountWithShippingCost(checkoutData.amount, paymentRequest.shippingMethods[0].amount, checkoutData.product.taxRate);
        paymentRequest.total.amount = amount.toFixed(2);
        checkoutData.shippingMethodId = paymentRequest.shippingMethods[0].identifier;
    }
}

/**
 * Get Apple Pay payment request
 * @param {Object} checkoutData data for creating apple pay payment
 * @param {[string]} supportedNetworks available networks
 * @param {string} acquirerCountry of the payment
 * @return {Object} apple pay payment request
 */
function getApplePaymentRequest(checkoutData, supportedNetworks, acquirerCountry) {
    let paymentRequest = {
        currencyCode: checkoutData.currency,
        countryCode: acquirerCountry || checkoutData.countryCode,
        total: {
            label: checkoutData.applepay.appleMerchantName,
            amount: checkoutData.amount
        },
        supportedNetworks: supportedNetworks,
        merchantCapabilities: ['supports3DS']
    };

    if (checkoutHelpers.isFromCartOrProductPage(checkoutHelpers.applePayMethod)) {
        requireBillingAndShippingInfo(paymentRequest);
    }

    if (checkoutHelpers.isFromProductPage(checkoutHelpers.applePayMethod) && checkoutData.shippingMethodOptions) {
        requireShippingOptions(paymentRequest, checkoutData);
    }
    return paymentRequest;
}

/**
 * Populate shipping/billing address and/or product details so that they can be processed later on
 * @param {Object} data the populated object
 * @param {{ token : { paymentData : Object }, billingContact : Object, shippingContact : Object }} paymentResult Apple Pay payment result
 * @param {Object} checkoutData data for creating apple pay payment
 */
function populateExpressCheckoutData(data, paymentResult, checkoutData) {
    let billingAddress = {};
    let shippingAddress = {};

    const email = paymentResult.shippingContact.emailAddress;
    const phone = paymentResult.shippingContact.phoneNumber;

    if (paymentResult.billingContact) {
        billingAddress = checkoutHelpers.getAddressFromApple(paymentResult.billingContact, email, phone);
    }

    if (paymentResult.shippingContact) {
        shippingAddress = checkoutHelpers.getAddressFromApple(paymentResult.shippingContact, email, phone);
    }

    data.billingAddress = JSON.stringify(billingAddress);
    data.shippingAddress = JSON.stringify(shippingAddress);

    if (checkoutData.product) {
        data.productId = checkoutData.product.productId;
        data.productQuantity = checkoutData.product.quantity;
    }

    if (checkoutData.shippingMethodId) {
        data.shippingMethodId = checkoutData.shippingMethodId;
    }
}

module.exports = {
    calculateAmountWithShippingCost: calculateAmountWithShippingCost,
    getApplePayCheckoutData: getApplePayCheckoutData,
    getApplePaymentRequest: getApplePaymentRequest,
    populateExpressCheckoutData: populateExpressCheckoutData,
    requireBillingAndShippingInfo: requireBillingAndShippingInfo,
    requireShippingOptions: requireShippingOptions
};
