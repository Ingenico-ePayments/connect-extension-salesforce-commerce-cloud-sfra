'use strict';

const applePayMethod = 'APPLE_PAY';
const googlePayMethod = 'GOOGLE_PAY';

/**
 * Returns the JQuery element for the specific payment method.
 * @param {string} paymentMethod the chosen payment method
 * @return {jQuery} jQuery element of the payment method button
 */
function getElementFromMethod(paymentMethod) {
    switch (paymentMethod) {
        case applePayMethod:
            return $('#apple-pay-button');
        case googlePayMethod:
            return $('#google-pay-button');
        default:
            throw new Error('Unknown payment method provided.');
    }
}

/**
 * Returns true if customer is on cart page.
 * @param {string} paymentMethod the chosen payment method
 * @return {boolean} true if element has 'from-cart' data element
 */
function isFromCartPage(paymentMethod) {
    return getElementFromMethod(paymentMethod).data('from-cart') === true;
}

/**
 * Returns true if customer is on product page.
 * @param {string} paymentMethod the chosen payment method
 * @return {boolean} true if element has 'from-product' data element
 */
function isFromProductPage(paymentMethod) {
    return getElementFromMethod(paymentMethod).data('from-product') === true;
}

/**
 * Returns true if customer is on checkout page.
 * @param {string} paymentMethod the chosen payment method
 * @return {boolean} true if element has 'from-checkout' data element
 */
function isFromCheckout(paymentMethod) {
    return getElementFromMethod(paymentMethod).data('from-checkout') === true;
}

/**
 * Returns true if customer is cart or product page.
 * @param {string} paymentMethod the chosen payment method
 * @return {boolean} true if element has 'from-cart' or 'from-product' data element
 */
function isFromCartOrProductPage(paymentMethod) {
    return isFromCartPage(paymentMethod) || isFromProductPage(paymentMethod);
}

/**
 * Extract first and last name
 * @param {string} name full name
 * @return {{firstName: string, lastName: string}} first and last name
 */
function getFirstAndLastName(name) {
    const names = name.split(' ');
    return {
        firstName: names.slice(0, -1).join(' '),
        lastName: names.slice(-1).join(' ')
    };
}

/**
 * Parse Apple or Google Pay address object
 * @param {Object} contact returned by Apple or Google Pay
 * @param {string} emailAddress of the consumer
 * @return {Object} parsed address
 */
function getAddress(contact, emailAddress) {
    let address = {};

    if (Object.prototype.hasOwnProperty.call(contact, 'address1')) {
        if (contact.name) {
            const names = getFirstAndLastName(contact.name);
            address.firstName = names.firstName;
            address.lastName = names.lastName;
        } else {
            address.firstName = contact.givenName;
            address.lastName = contact.familyName;
        }

        address.address1 = contact.address1;
        address.address2 = contact.address2;
        address.city = contact.locality;
        address.postalCode = contact.postalCode;
        address.countryCode = contact.countryCode;
        address.phone = contact.phoneNumber;
    }

    address.email = emailAddress || contact.email;

    return address;
}

/**
 * Parse Apple Pay address object
 * @param {Object} contact returned by Apple Pay
 * @param {string} emailAddress of the consumer
 * @param {string} phoneNumber of the consumer
 * @return {Object} parsed address
 */
function getAddressFromApple(contact, emailAddress, phoneNumber) {
    contact.address1 = contact.addressLines[0];
    contact.address2 = contact.addressLines[1];
    contact.phoneNumber = phoneNumber;
    return getAddress(contact, emailAddress);
}

/**
 * Get Ingenico Client Session details object
 * @param {Object} context for IngenicoSDK session
 * @return {{clientSessionId: *, customerId: *, clientApiUrl: *, assetUrl: *}} IngenicoSDK session object
 */
function getIngenicoSessionDetails(context) {
    return {
        clientSessionId: context.clientSessionId,
        customerId: context.customerId,
        clientApiUrl: context.clientApiUrl,
        assetUrl: context.assetUrl
    };
}

/**
 * Construct IngenicoSDK payment details object from the provided checkout data
 * @param {{amount : number, country : string, currency : string, locale : string}} checkoutData data for creating Apple or Google Pay payment
 * @return {Object} IngenicoSDK payment object
 */
function getPaymentDetails(checkoutData) {
    return {
        totalAmount: Math.round(checkoutData.amount * 100), // convert total amount to cents
        countryCode: checkoutData.country,
        currency: checkoutData.currency,
        locale: checkoutData.locale,
        isRecurring: false
    };
}

/**
 * Get shipping cost for the given id
 * @param {[]} shippingOptions list of shipping options
 * @param {string} id of the shipping option
 * @return {Object} shipping cost of the given shipping option
 */
function getShippingCost(shippingOptions, id) {
    return shippingOptions.find(option => option.identifier === id).amount;
}

/**
 * Get CSRF token
 * @param {string} getCsrfTokenUrl URL of CSRF controller
 * @return {{token: string, tokenName: string}} csrf token and token name
 */
function getCsrfToken(getCsrfTokenUrl) {
    let csrf = null;
    $.ajax({
        url: getCsrfTokenUrl,
        type: 'POST',
        async: false,
        success: function (response) {
            if (response.csrf) {
                csrf = response.csrf;
            }
        }
    });
    return csrf;
}

/**
 * Submit data to redirectUrl so that the backend can complete the payment.
 * @param {string} redirectUrl URL to the backend
 * @param {Object} data that needs to be posted to the backend
 * @param {string} getCsrfTokenUrl URL of CSRF controller
 */
function postData(redirectUrl, data, getCsrfTokenUrl) {
    let form = document.createElement('form');
    form.setAttribute('method', 'post');
    form.setAttribute('action', redirectUrl);
    form.style.display = 'none';

    for (const key in data) { // eslint-disable-line no-restricted-syntax
        if (Object.hasOwnProperty.call(data, key)) {
            var hiddenField = document.createElement('input');
            hiddenField.setAttribute('type', 'hidden');
            hiddenField.setAttribute('name', key);
            hiddenField.setAttribute('value', data[key]);
            form.appendChild(hiddenField);
        }
    }
    if (getCsrfTokenUrl) {
        let csrf = getCsrfToken(getCsrfTokenUrl);
        if (csrf) {
            let csrfTokenElement = document.createElement('input');
            csrfTokenElement.setAttribute('type', 'hidden');
            csrfTokenElement.setAttribute('name', csrf.tokenName);
            csrfTokenElement.setAttribute('value', csrf.token);
            form.appendChild(csrfTokenElement);
        }

        document.body.appendChild(form);
        form.submit();
    }
}

module.exports = {
    applePayMethod: applePayMethod,
    googlePayMethod: googlePayMethod,
    isFromCartPage: isFromCartPage,
    isFromCheckout: isFromCheckout,
    isFromProductPage: isFromProductPage,
    isFromCartOrProductPage: isFromCartOrProductPage,
    getAddress: getAddress,
    getAddressFromApple: getAddressFromApple,
    getIngenicoSessionDetails: getIngenicoSessionDetails,
    getPaymentDetails: getPaymentDetails,
    getShippingCost: getShippingCost,
    postData: postData
};
