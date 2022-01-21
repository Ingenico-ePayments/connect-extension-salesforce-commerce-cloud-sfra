/* global google, Promise */
'use strict';
const ConnectSDK = require('./connect/connectsdk');
const checkoutHelpers = require('./helpers/checkoutHelpers');
const googlepayHelpers = require('./helpers/googlepayHelpers');

let session = null;
let paymentsClient = null;
let paymentDataRequest = null;

/**
 * Show error message
 */
function showErrorMessage() {
    $('#checkout-main').prepend('<div class="row" id="mobile-payment-error"><div class="col-sm-7"><div class="alert text-center alert-danger alert-dismissible fade show" role="alert">' +
        'Paying with Google Pay is currently not possible. We apologise for the inconvenience.<button type="button" class="close" data-dismiss="alert" aria-label="Close"><span aria-hidden="true">&times;</span></button></div></div></div>');
    // enable the next button here
    $('.next-step-button button').prop('disabled', false);
}

/**
 * Return payment data that will be used by the backend.
 * @param {Object} checkoutData checkout data for creating Google Pay payment
 * @param {Object} paymentToken returned by Google Pay
 * @return {Object} payment processing data object for the backend
 */
function getPaymentProcessingData(checkoutData, paymentToken) {
    return {
        amount: checkoutData.amount,
        currencyCode: checkoutData.currency,
        encryptedPaymentData: paymentToken,
        isFromCheckout: checkoutHelpers.isFromCheckout(checkoutHelpers.googlePayMethod) === true,
        paymentMethod: checkoutHelpers.googlePayMethod
    };
}

/**
 * Get Google Pay button container element Id
 * @return {jQuery|HTMLElement} jQuery element of google pay button
 */
function getGooglePayButtonElement() {
    return $('#google-pay-button');
}

/**
 * Process payment data returned by the Google Pay API
 * @param {Object} paymentData response from Google Pay API after user approves payment
 * @see {@link https://developers.google.com/pay/api/web/reference/object#PaymentData|PaymentData object reference}
 * @return {Promise} promise object that submits data to backend
 */
function processPayment(paymentData) {
    return new Promise(function (resolve) {
        const paymentToken = paymentData.paymentMethodData.tokenizationData.token;
        const checkoutData = googlepayHelpers.getGooglePayCheckoutData();

        let data = getPaymentProcessingData(checkoutData, paymentToken);
        if (checkoutHelpers.isFromCheckout(checkoutHelpers.googlePayMethod) !== true) {
            googlepayHelpers.populateExpressCheckoutData(data, paymentData, checkoutData);
        }

        // post data to returnUrl (backend) so that the payment data can be processed
        resolve(checkoutHelpers.postData(checkoutData.returnUrl, data, checkoutData.csrfTokenUrl));
    });
}

/**
 * Handles authorize payments callback intents.
 *
 * @param {Object} paymentData response from Google Pay API after a payer approves payment through user gesture.
 * @see {@link https://developers.google.com/pay/api/web/reference/response-objects#PaymentData object reference}
 *
 * @see {@link https://developers.google.com/pay/api/web/reference/response-objects#PaymentAuthorizationResult}
 * @return {Promise} Promise of PaymentAuthorizationResult object to acknowledge the payment authorization status.
 */
function onPaymentAuthorized(paymentData) {
    return new Promise(function (resolve) {
        // handle the response
        processPayment(paymentData)
            .then(function () {
                resolve({ transactionState: 'SUCCESS' });
            })
            .catch(function (err) {
                resolve({
                    transactionState: 'ERROR',
                    error: {
                        intent: 'PAYMENT_AUTHORIZATION',
                        message: err.message,
                        reason: 'PAYMENT_DATA_INVALID'
                    }
                });
            });
    });
}

/**
 * Handles dynamic buy flow shipping address and shipping options callback intents.
 *
 * @param {Object} intermediatePaymentData response from Google Pay API a shipping address or shipping option is selected in the payment sheet.
 * @see {@link https://developers.google.com/pay/api/web/reference/response-objects#IntermediatePaymentData|IntermediatePaymentData object reference}
 *
 * @see {@link https://developers.google.com/pay/api/web/reference/response-objects#PaymentDataRequestUpdate|PaymentDataRequestUpdate}
 * @return {Promise} Promise of PaymentDataRequestUpdate object to update the payment sheet.
 */
function onPaymentDataChanged(intermediatePaymentData) {
    return new Promise(function (resolve) {
        let shippingOptionData = intermediatePaymentData.shippingOptionData;
        let paymentDataRequestUpdate = {};
        let selectedShippingOptionId;
        const checkoutData = googlepayHelpers.getGooglePayCheckoutData();
        const shippingOptions = googlepayHelpers.getGooglePayShippingOptions();

        // Add "SHIPPING_ADDRESS" to the if-check if "SHIPPING_ADDRESS" is specified in the callbackIntents
        if (intermediatePaymentData.callbackTrigger === 'INITIALIZE') {
            paymentDataRequestUpdate.newShippingOptionParameters = {
                shippingOptions: shippingOptions
            };
            selectedShippingOptionId = shippingOptions[0].id;
        } else if (intermediatePaymentData.callbackTrigger === 'SHIPPING_OPTION') {
            selectedShippingOptionId = shippingOptionData.id;
        }

        const shippingCost = checkoutHelpers.getShippingCost(checkoutData.shippingMethodOptions, selectedShippingOptionId);
        paymentDataRequestUpdate.newTransactionInfo = googlepayHelpers.calculateNewTransactionInfo(checkoutData, shippingCost);

        resolve(paymentDataRequestUpdate);
    });
}

/**
 * Return an active PaymentsClient or initialize
 *
 * @see {@link https://developers.google.com/pay/api/web/reference/client#PaymentsClient|PaymentsClient constructor}
 * @return {google.payments.api.PaymentsClient} Google Pay API client
 */
function getGooglePaymentsClient() {
    if (paymentsClient === null) {
        const checkoutData = googlepayHelpers.getGooglePayCheckoutData();
        let paymentsClientData = {
            environment: checkoutData.googlePay.googleEnvironment,
            paymentDataCallbacks: {
                onPaymentAuthorized: onPaymentAuthorized
            }
        };

        // if Google Pay is initiated from product detail page, Dynamic Price Updates must be set up
        if (checkoutHelpers.isFromProductPage(checkoutHelpers.googlePayMethod)) {
            paymentsClientData.paymentDataCallbacks.onPaymentDataChanged = onPaymentDataChanged;
        }
        paymentsClient = new google.payments.api.PaymentsClient(paymentsClientData);
    }
    return paymentsClient;
}

/**
 * Show Google Pay payment sheet when Google Pay payment button is clicked
 */
function onGooglePaymentButtonClicked() {
    const paymentsClient = getGooglePaymentsClient();

    if (checkoutHelpers.isFromCartOrProductPage(checkoutHelpers.googlePayMethod)) {
        // Only require shipping and billing address info if button has been triggered from the Cart or product detail page
        // as there is no billing/shipping info available yet.
        googlepayHelpers.requireBillingAndShippingInfo(paymentDataRequest);

        if (checkoutHelpers.isFromProductPage(checkoutHelpers.googlePayMethod)) {
            googlepayHelpers.requireShippingOptions(paymentDataRequest);
            // check if basket contains other products, if so, show an alert to the customer
            const checkoutData = googlepayHelpers.getGooglePayCheckoutData();
            if (checkoutData.hasOtherProductsInBasket) {
                // Here you can hook into for customizing your business logic.
                // This alert is just an example.
                alert('Note that other products in your basket will be lost.');
            }
        }
    }

    if (paymentDataRequest != null) {
        paymentDataRequest.transactionInfo = googlepayHelpers.getTransactionInfo();
    }

    paymentsClient.loadPaymentData(paymentDataRequest)
        .catch(function () {
            showErrorMessage();
        });
}

/**
 * Add a Google Pay purchase button alongside an existing checkout button
 * @see {@link https://developers.google.com/pay/api/web/reference/object#ButtonOptions|Button options}
 * @see {@link https://developers.google.com/pay/api/web/guides/brand-guidelines|Google Pay brand guidelines}
 */
function addGooglePayButton() {
    const paymentsClient = getGooglePaymentsClient();
    const button =
        paymentsClient.createButton({
            buttonSizeMode: 'fill',
            onClick: onGooglePaymentButtonClicked
        });
    document.getElementById('googlepay-button-container').appendChild(button);
}

/**
 * Show Google Pay button if customer is on cart or product detail page.
 */
function showGooglePayButton() {
    if (checkoutHelpers.isFromCartOrProductPage(checkoutHelpers.googlePayMethod)) {
        // only show the google pay button on the cart and product page
        addGooglePayButton();
    }
}

/**
 * Initialize Google PaymentsClient after a IngenicoSDK session has been created
 */
function initGooglePay() {
    const checkoutData = googlepayHelpers.getGooglePayCheckoutData();

    if (!checkoutData || !checkoutData.clientSessionUrl) {
        showErrorMessage();
        return;
    }

    $.ajax({
        url: checkoutData.clientSessionUrl,
        type: 'get',
        dataType: 'json',
        success: function (context) {
            // create Ingenico client session
            const sessionDetails = checkoutHelpers.getIngenicoSessionDetails(context);
            session = new ConnectSDK(sessionDetails);

            const paymentDetails = checkoutHelpers.getPaymentDetails(checkoutData);
            const paymentProductSpecificInputs = googlepayHelpers.getGooglePaySpecificInputs(checkoutData);
            let transactionInfo = googlepayHelpers.getTransactionInfo();

            // session is an instance of the Session object, which is the main entry point for the SDK
            session.getPaymentProduct(320, paymentDetails, paymentProductSpecificInputs).then(
                function (paymentProduct) {
                    const acquirerCountry = paymentProduct.acquirerCountry;
                    if (acquirerCountry != null) {
                        transactionInfo.countryCode = acquirerCountry;
                    }

                    paymentDataRequest = googlepayHelpers.getGooglePaymentDataRequest(paymentProduct, paymentProductSpecificInputs, transactionInfo);
                    showGooglePayButton();
                },
                function () {
                    // Google Pay is not available, offer your customer another payment option to complete the payment
                    $('#googlepay-button-container').find(':button').hide();
                }
            );
        }
    });
}
$(document).ready(function () {
    initGooglePay();
    const gpayButton = getGooglePayButtonElement();
    let googlePayContainer = $('#googlepay-button-container');

    gpayButton.on('checkout:googlepay', function () {
        // remove existing error messages first
        $('#mobile-payment-error').remove();

        onGooglePaymentButtonClicked();
    });

    gpayButton.on('ingenico:enableGooglePay', function () {
        // make google pay button visible
        if (googlePayContainer.find(':button').length === 0) {
            initGooglePay();
        }

        if (googlePayContainer.find(':button').length > 0) {
            googlePayContainer.find(':button').show();
        }
    });

    gpayButton.on('ingenico:disableGooglePay', function () {
        // hide google pay button
        if (googlePayContainer.find(':button').length > 0) {
            googlePayContainer.find(':button').hide();
        }
    });
});
