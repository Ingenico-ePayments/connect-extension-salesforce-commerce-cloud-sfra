/* global ApplePaySession, Promise */
'use strict';
const ConnectSDK = require('./connect/connectsdk');
const checkoutHelpers = require('./helpers/checkoutHelpers');
const applepayHelpers = require('./helpers/applepayHelpers');

let session;
let applePaySession;

/**
 * Show error message
 */
function showErrorMessage() {
    $('#checkout-main').prepend('<div class="row" id="mobile-payment-error"><div class="col-sm-7"><div class="alert text-center alert-danger alert-dismissible fade show" role="alert">' +
        'Paying with Apple Pay is currently not possible. We apologise for the inconvenience.<button type="button" class="close" data-dismiss="alert" aria-label="Close"><span aria-hidden="true">&times;</span></button></div></div></div>');
    // enable the next button here
    $('.next-step-button button').prop('disabled', false);
}

/**
 * Construct payment processing data object for the backend
 * @param {{ token : { paymentData : Object }, billingContact : Object, shippingContact : Object }} paymentResult Apple Pay payment data
 * @param {Object} checkoutData input data
 * @return {Object} payment processing data object for the backend
 */
function getPaymentProcessingData(paymentResult, checkoutData) {
    let paymentProcessData = {
        encryptedPaymentData: JSON.stringify(paymentResult.token.paymentData),
        amount: checkoutData.amount,
        currencyCode: checkoutData.currency,
        isFromCheckout: checkoutHelpers.isFromCheckout(checkoutHelpers.applePayMethod) === true,
        paymentMethod: checkoutHelpers.applePayMethod
    };
    if (checkoutHelpers.isFromCheckout(checkoutHelpers.applePayMethod) !== true) {
        applepayHelpers.populateExpressCheckoutData(paymentProcessData, paymentResult, checkoutData);
    }
    return paymentProcessData;
}

/**
 * Get validate merchant request object
 * @param {Object} event with the validationURL
 * @param {Object} checkoutData data for creating Apple Pay payment
 * @return {Object} validateMerchant object
 */
function getValidateMerchantRequest(event, checkoutData) {
    return {
        validationURL: event.validationURL,
        displayName: checkoutData.applepay.appleMerchantName,
        domainName: window.location.hostname
    };
}

/**
 * Get Apple Pay button container element
 * @return {jQuery|HTMLElement} jQuery element of apple pay button container
 */
function getApplePayButtonContainer() {
    return $('.apple-button-container');
}

/**
 * Get Apple Pay button element
 * @return {jQuery|HTMLElement} jQuery element of apple pay button
 */
function getApplePayButtonElement() {
    return $('#apple-pay-button');
}

/**
 * Show Apple Pay payment sheet when Apple Pay payment button is clicked
 *
 * @see https://developer.apple.com/documentation/apple_pay_on_the_web/apple_pay_js_api
 */
function onApplePayButtonClicked() {
    // remove all existing errors first
    $('#mobile-payment-error').remove();

    let checkoutData = applepayHelpers.getApplePayCheckoutData();
    let connectPaymentRequest = session.getPaymentRequest();

    if (!connectPaymentRequest.getPaymentProduct() || !connectPaymentRequest.getPaymentProduct().paymentProduct302SpecificData) {
        showErrorMessage();
        return;
    }

    const supportedNetworks = connectPaymentRequest.getPaymentProduct().paymentProduct302SpecificData.networks;
    const acquirerCountry = connectPaymentRequest.getPaymentProduct().acquirerCountry;
    const paymentRequest = applepayHelpers.getApplePaymentRequest(checkoutData, supportedNetworks, acquirerCountry);
    if (checkoutData.hasOtherProductsInBasket) {
        // Here you can hook into for customizing your business logic.
        // This alert is just an example.
        alert('Note that other products in your basket will be lost.');
    }

    applePaySession = new ApplePaySession(1, paymentRequest);
    applePaySession.begin();

    applePaySession.onvalidatemerchant = function (event) {
        let validateMerchantRequest = getValidateMerchantRequest(event, checkoutData);
        session.createPaymentProductSession('302', validateMerchantRequest).then(function (merchantSession) {
            try {
                applePaySession.completeMerchantValidation(JSON.parse(merchantSession.paymentProductSession302SpecificOutput.sessionObject));
            } catch (e) {
                applePaySession.abort();
                showErrorMessage();
            }
        }, function () {
            applePaySession.abort();
            showErrorMessage();
        });
    };

    applePaySession.onshippingmethodselected = function (event) {
        const newLineItems = [];
        const amount = applepayHelpers.calculateAmountWithShippingCost(checkoutData.amount, event.shippingMethod.amount, checkoutData.product.taxRate);

        const newTotal = {
            label: checkoutData.applepay.appleMerchantName,
            amount: amount.toFixed(2)
        };
        checkoutData.shippingMethodId = event.shippingMethod.identifier;
        applePaySession.completeShippingMethodSelection(status, newTotal, newLineItems);
    };

    applePaySession.onpaymentauthorized = function (event) {
        return new Promise(function (resolve) {
            let status;
            if (!event.payment) {
                status = ApplePaySession.STATUS_FAILURE;
                applePaySession.completePayment(status);
                showErrorMessage();
            } else {
                status = ApplePaySession.STATUS_SUCCESS;

                const data = getPaymentProcessingData(event.payment, checkoutData);

                // post data to returnUrl (backend) so that the payment data can be processed
                resolve(checkoutHelpers.postData(checkoutData.returnUrl, data, checkoutData.csrfTokenUrl));

                applePaySession.completePayment(status);
            }
        });
    };

    applePaySession.oncancel = function () {
        // enable the next button here
        $('.next-step-button button').prop('disabled', false);

        $('#body').load(window.location.href + ' #apple-button-container');
    };
}


/**
 * Initialize a IngenicoSDK session
 */
function initApplePay() {
    const checkoutData = applepayHelpers.getApplePayCheckoutData();
    if (checkoutData && checkoutData.clientSessionUrl) {
        $.ajax({
            url: checkoutData.clientSessionUrl,
            type: 'get',
            dataType: 'json',
            success: function (context) {
                const sessionDetails = checkoutHelpers.getIngenicoSessionDetails(context);
                session = new ConnectSDK(sessionDetails);

                let paymentProductSpecificInputs = null;
                const applePayContainer = getApplePayButtonContainer();
                const paymentDetails = checkoutHelpers.getPaymentDetails(checkoutData);

                // session is an instance of the Session object, which is the main entry point for the SDK
                session.getPaymentProduct(302, paymentDetails, paymentProductSpecificInputs).then(
                    function (paymentProduct) {
                        // Apple Pay is available, show the Apple Pay button (if not on checkout page)
                        if (checkoutHelpers.isFromCartOrProductPage(checkoutHelpers.applePayMethod)) {
                            // only show the google pay button on the cart and product page
                            applePayContainer.show();
                            applePayContainer.removeClass('hidden');
                            $('#body').load(window.location.href + ' #apple-button-container');
                        }

                        // Store the payment product in the Connect payment request
                        session.getPaymentRequest().setPaymentProduct(paymentProduct);
                    },
                    function () {
                        // Apple Pay is not available, offer your customer another payment option to complete the payment
                        applePayContainer.hide();
                        $('#body').load(window.location.href + ' #apple-button-container');
                    }
                );
            }
        });
    }
}

$(document).ready(function () {
    initApplePay();
    let applePayContainer = getApplePayButtonContainer();

    getApplePayButtonElement().on('click', function () {
        onApplePayButtonClicked();
    });

    applePayContainer.on('ingenico:enableApplePay', function () {
        // make apple pay button visible
        if (applePayContainer.length > 0) {
            initApplePay();
            applePayContainer.show();
            applePayContainer.removeClass('hidden');
            $('#body').load(window.location.href + ' #apple-button-container');
        }
    });

    applePayContainer.on('ingenico:disableApplePay', function () {
        // hide apple pay button
        if (applePayContainer.length > 0) {
            applePayContainer.hide();
            $('#body').load(window.location.href + ' #apple-button-container');
        }
    });

    // Apple Pay triggered from checkout flow
    getApplePayButtonElement().on('checkout:applepay', function () {
        onApplePayButtonClicked();
    });
});
