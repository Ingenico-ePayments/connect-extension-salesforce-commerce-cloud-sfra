'use strict';

/**
 * Update express checkout data for Apple or Google Pay
 * @param {string} expressCheckoutElementId id of the hidden input for which express checkout data is stored
 * @param {Object} updatedData object with updated values
 */
function updateExpressCheckoutData(expressCheckoutElementId, updatedData) {
    if (document.getElementById(expressCheckoutElementId)) {
        const expressCheckoutElement = document.getElementById(expressCheckoutElementId);
        const expressCheckoutData = expressCheckoutElement.value
            ? JSON.parse(expressCheckoutElement.value)
            : {};

        expressCheckoutData.amount = updatedData.totalAmount || expressCheckoutData.amount;
        expressCheckoutData.currency = updatedData.currencyCode || expressCheckoutData.currency;
        expressCheckoutData.country = updatedData.countryCode || expressCheckoutData.country;
        expressCheckoutData.locale = updatedData.locale || expressCheckoutData.locale;
        expressCheckoutData.shippingMethodOptions = updatedData.shippingMethods || expressCheckoutData.shippingMethodOptions;
        expressCheckoutData.product = updatedData.product || expressCheckoutData.product;

        document.getElementById(expressCheckoutElementId).value = JSON.stringify(expressCheckoutData);
    }
}

module.exports = {
    updateExpressCheckoutData: updateExpressCheckoutData
};
