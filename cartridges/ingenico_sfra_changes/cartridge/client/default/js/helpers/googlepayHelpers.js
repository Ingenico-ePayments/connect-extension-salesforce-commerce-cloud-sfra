'use strict';
const checkoutHelpers = require('./checkoutHelpers');

/**
 * Define the version of the Google Pay API referenced when creating your
 * configuration
 *
 * @see {@link https://developers.google.com/pay/api/web/reference/object#PaymentDataRequest|apiVersion in PaymentDataRequest}
 */
const baseRequest = {
    apiVersion: 2,
    apiVersionMinor: 0
};

/**
 * Card authentication methods supported by your site and your gateway
 *
 * @see {@link https://developers.google.com/pay/api/web/reference/object#CardParameters|CardParameters}
 */
const allowedCardAuthMethods = ['PAN_ONLY', 'CRYPTOGRAM_3DS'];

/**
 * Get the checkout data for Google Pay that is stored on hidden input element
 * @return {Object} Google Pay checkout data as JSON
 */
function getGooglePayCheckoutData() {
    const googlePayData = document.getElementById('ingenico_googlepay_data').value;
    return googlePayData ? JSON.parse(googlePayData) : {};
}

/**
 * Provide Google Pay API with a payment amount, currency, and amount status
 * @see {@link https://developers.google.com/pay/api/web/reference/object#TransactionInfo|TransactionInfo}
 * @return {Object} transaction info, suitable for use as transactionInfo property of PaymentDataRequest
 */
function getTransactionInfo() {
    const checkoutData = getGooglePayCheckoutData();
    return {
        checkoutOption: 'COMPLETE_IMMEDIATE_PURCHASE',
        currencyCode: checkoutData.currency,
        totalPriceStatus: 'FINAL',
        totalPrice: String(checkoutData.amount)
    };
}

/**
 * Calculate new transactionInfo for the selected shipping method
 * @see {@link https://developers.google.com/pay/api/web/reference/object#TransactionInfo|TransactionInfo}
 * @param {Object} checkoutData checkout data for Google Pay payment
 * @param {number} shippingCost shipping cost of the selected shipping option
 * @return {Object} transactionInfo with the updated amount
 */
function calculateNewTransactionInfo(checkoutData, shippingCost) {
    let newTransactionInfo = getTransactionInfo();
    const taxRate = checkoutData.product.taxRate;
    let amount = checkoutData.amount + shippingCost;

    if (taxRate) {
        let orderAmountTax = checkoutData.amount * taxRate;
        let shippingCostTax = shippingCost * taxRate;
        amount += orderAmountTax + shippingCostTax;
    }

    newTransactionInfo.totalPrice = amount.toFixed(2);
    return newTransactionInfo;
}

/**
 * Configure support for the Google Pay API
 * @see {@link https://developers.google.com/pay/api/web/reference/request-objects#PaymentDataRequest|PaymentDataRequest}
 * @param {Object} paymentProduct IngenicoSDK paymentProduct object
 * @param {Object} paymentProductSpecificInputs IngenicoSDK paymentProductSpecificInputs object
 * @param {Object} transactionInfo for PaymentDataRequest object
 * @return {Object} PaymentDataRequest fields
 */
function getGooglePaymentDataRequest(paymentProduct, paymentProductSpecificInputs, transactionInfo) {
    const tokenizationSpecification = {
        type: 'PAYMENT_GATEWAY',
        parameters: {
            gateway: paymentProduct.paymentProduct320SpecificData.gateway,
            gatewayMerchantId: paymentProductSpecificInputs.googlePay.gatewayMerchantId
        }
    };
    const baseCardPaymentMethod = {
        type: 'CARD',
        parameters: {
            allowedAuthMethods: allowedCardAuthMethods,
            allowedCardNetworks: paymentProduct.paymentProduct320SpecificData.networks,
            billingAddressRequired: false
        }
    };
    // Describe your site's support for the CARD payment method including optional
    const cardPaymentMethod = Object.assign(
        {},
        baseCardPaymentMethod,
        {
            tokenizationSpecification: tokenizationSpecification
        }
    );

    const paymentDataRequest = Object.assign({}, baseRequest);
    paymentDataRequest.allowedPaymentMethods = [cardPaymentMethod];
    paymentDataRequest.transactionInfo = transactionInfo;
    paymentDataRequest.merchantInfo = {
        merchantName: paymentProductSpecificInputs.googlePay.merchantName, // merchant name rendered in payment sheet
        merchantId: paymentProductSpecificInputs.googlePay.merchantId      // your google merchant identifier
    };

    paymentDataRequest.callbackIntents = ['PAYMENT_AUTHORIZATION'];

    return paymentDataRequest;
}

/**
 * Get paymentProductSpecificInput object for Google Pay
 * @param {Object} checkoutData checkout data for Google Pay payment
 * @return {{googlePay: {merchantId: *, gatewayMerchantId: *, merchantName: *}}} paymentProductSpecificInputs fields
 */
function getGooglePaySpecificInputs(checkoutData) {
    // If you want to use Google Pay in your application, you are required to register
    // with Google in order to receive a Google Merchant ID
    const paymentProductSpecificInputs = {
        googlePay: {
            merchantName: checkoutData.googlePay.googleMerchantName,           // merchant name rendered in payment sheet
            merchantId: checkoutData.googlePay.googleMerchantId,               // your google merchant identifier
            gatewayMerchantId: checkoutData.googlePay.ingenicoMerchantId // your ingenico merchant id
        }
    };
    return paymentProductSpecificInputs;
}

/**
 * Get a list of shipping options for Google Pay
 * @return {{description: *, id: *, label: *}[]} list of shipping options
 */
function getGooglePayShippingOptions() {
    const checkoutData = getGooglePayCheckoutData();
    return checkoutData.shippingMethodOptions.map(item => ({
        id: item.identifier,
        label: item.label,
        description: item.detail
    }));
}

/**
 * Parse Google Pay address object
 * @param {Object} address object from Google Pay
 * @param {string} email of the consumer
 * @return {string} address object as JSON string
 */
function getAddress(address, email) {
    return address
        ? JSON.stringify(checkoutHelpers.getAddress(address, email))
        : {};
}

/**
 * Populate shipping/billing address and/or product details so that they can be processed later on
 * @param {Object} data the populated object
 * @param {Object} paymentData returned by Google Pay
 * @param {Object} checkoutData data for creating Google Pay payment
 */
function populateExpressCheckoutData(data, paymentData, checkoutData) {
    const email = paymentData.email || null;
    data.billingAddress = getAddress(paymentData.paymentMethodData.info.billingAddress, email);
    data.shippingAddress = getAddress(paymentData.shippingAddress, email);

    if (checkoutData.product) {
        data.productId = checkoutData.product.productId;
        data.productQuantity = checkoutData.product.quantity;
    }

    if (paymentData.shippingOptionData) {
        data.shippingMethodId = paymentData.shippingOptionData.id;
    }
}

/**
 * Update the paymentDataRequest so that the billing and shipping address are returned in the response
 * @param {Object} paymentDataRequest for creating Google Pay payment
 */
function requireBillingAndShippingInfo(paymentDataRequest) {
    paymentDataRequest.allowedPaymentMethods[0].parameters.billingAddressRequired = true;
    paymentDataRequest.allowedPaymentMethods[0].parameters.billingAddressParameters = {
        format: 'FULL',
        phoneNumberRequired: true
    };
    paymentDataRequest.shippingAddressRequired = true;
    paymentDataRequest.shippingAddressParameters = {
        phoneNumberRequired: true
    };
    paymentDataRequest.emailRequired = true;
}

/**
 * Update the paymentDataRequest so that the customer can select a shipping method
 * @param {Object} paymentDataRequest for creating Google Pay payment
 */
function requireShippingOptions(paymentDataRequest) {
    // Require shipping options and register callback intent
    paymentDataRequest.shippingOptionRequired = true;
    paymentDataRequest.callbackIntents = ['SHIPPING_OPTION', 'PAYMENT_AUTHORIZATION'];
    paymentDataRequest.shippingOptionParameters = {
        shippingOptions: getGooglePayShippingOptions()
    };
}

module.exports = {
    calculateNewTransactionInfo: calculateNewTransactionInfo,
    getGooglePayCheckoutData: getGooglePayCheckoutData,
    getGooglePaymentDataRequest: getGooglePaymentDataRequest,
    getGooglePaySpecificInputs: getGooglePaySpecificInputs,
    getGooglePayShippingOptions: getGooglePayShippingOptions,
    getTransactionInfo: getTransactionInfo,
    requireBillingAndShippingInfo: requireBillingAndShippingInfo,
    requireShippingOptions: requireShippingOptions,
    populateExpressCheckoutData: populateExpressCheckoutData
};
