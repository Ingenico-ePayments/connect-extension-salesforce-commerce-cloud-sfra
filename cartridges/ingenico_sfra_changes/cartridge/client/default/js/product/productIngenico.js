'use strict';

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
 * Enable Google Pay and Apple Pay button after retrieving the express checkout data.
 * @param {string} url to retrieve express checkout data
 * @param {{id: string, selectedQuantity: number}} product the selected product
 * @param {string} paymentMethod of the checkout button
 */
function enableExpressCheckoutButton(url, product, paymentMethod) {
    $.ajax({
        url: url + '?productId=' + product.id + '&productQuantity=' + product.selectedQuantity + '&paymentMethod=' + paymentMethod,
        type: 'get',
        dataType: 'json',
        success: function (data) {
            if (data) {
                // enable Apple/Google Pay button
                if (paymentMethod === 'GOOGLE_PAY') {
                    document.getElementById('ingenico_googlepay_data').value = JSON.stringify(data);
                    getGooglePayButton().trigger('ingenico:enableGooglePay');
                } else if (paymentMethod === 'APPLE_PAY') {
                    document.getElementById('ingenico_applepay_data').value = JSON.stringify(data);
                    getApplePayButton().trigger('ingenico:enableApplePay');
                }
            }
        },
        error: function (err) {
            console.warn(err);
        }
    });
}

module.exports = function () {
    $('body').on('product:updateAddToCart', function (e, data) {
        // if product is ready to be ordered, enable the apple/google pay button
        const product = data.product;
        const expressCheckoutDataUrl = document.getElementById('ingenico_express_checkout_data_url').value;

        if (product.readyToOrder) {
            enableExpressCheckoutButton(expressCheckoutDataUrl, product, 'GOOGLE_PAY');
            enableExpressCheckoutButton(expressCheckoutDataUrl, product, 'APPLE_PAY');
        } else {
            getGooglePayButton().trigger('product:disableGooglePay');
            getApplePayButton().trigger('product:disableApplePay');
        }
    });
};
