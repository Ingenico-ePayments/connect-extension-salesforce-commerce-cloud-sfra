/* global request */

'use strict';

/**
 * IngenicoPayByLink.js
 *
 * Controller that handles Ingenico's Pay-By-Link requests:
 * - it creates a new RPP session if there is no existing one or expired
 * - redirects the customer to the RPP
 * - or redirects the customer to a page indicating that there has already been paid.
 */

const server = require('server');

const OrderMgr = require('dw/order/OrderMgr');
const Transaction = require('dw/system/Transaction');

const PayByLinkStatus = {
    ALREADY_PAID: 'ALREADY_PAID',
    RPP_SESSION_VALID: 'RPP_SESSION_VALID',
    NO_RPP_SESSION: 'NO_RPP_SESSION'
};

/**
 * Decrypt the hash
 * @param {dw.web.HttpParameterMap} parameterMap of the http request
 * @returns {Object} decrypted JSON object
 */
function decryptHash(parameterMap) {
    const StringUtils = require('dw/util/StringUtils');
    const Encoding = require('dw/crypto/Encoding');
    const Cipher = require('dw/crypto/Cipher');
    const Bytes = require('dw/util/Bytes');
    const ingenicoPreferences = require('*/cartridge/scripts/ingenicoPreferences');

    const cipher = new Cipher();
    const secretKey = Encoding.toBase64(new Bytes(ingenicoPreferences.getPayByLinkSecretKey()));
    const iv = Encoding.toBase64(new Bytes(ingenicoPreferences.getPayByLinkSecretIV()));
    const transformation = 'AES/CBC/PKCS5Padding';
    const iterations = 10;
    let encryptedData = Encoding.fromBase64(parameterMap.get('id').getStringValue());

    var decryptedData = cipher.decrypt(StringUtils.trim(encryptedData), secretKey, transformation, iv, iterations);
    return JSON.parse(decryptedData);
}

/**
 * Find payment instrument with payment method PAY_BY_LINK
 * @param {dw.order.Order} order that is linked to the payment link
 * @returns {dw.order.OrderPaymentInstrument | null} payment instrument
 */
function findPaymentInstrument(order) {
    const paymentInstruments = order.getPaymentInstruments().toArray()
        .filter(function (pi) {
            return pi.paymentMethod === 'PAY_BY_LINK';
        });
    return paymentInstruments.length > 0 ? paymentInstruments[0] : null;
}

/**
 * Creates an Ingenico Hosted Checkout and returns the response
 * @param {dw.order.OrderPaymentInstrument} paymentInstrument of the order
 * @param {dw.order.Order} order for which a hosted checkout must be created
 * @returns {Object} a hosted checkout response
 */
function createHostedCheckout(paymentInstrument, order) {
    const ingenicoHelpers = require('*/cartridge/scripts/ingenicoHelpers');
    const ingenicoPayloadHelpers = require('*/cartridge/scripts/ingenicoPayloadHelpers');
    const ingenicoPreferences = require('*/cartridge/scripts/ingenicoPreferences');

    const requiresApproval = ingenicoPreferences.getCardRequiresApproval();
    const variantId = ingenicoPreferences.getVariantId();
    const variantIdGuest = ingenicoPreferences.getVariantIdGuest();

    const requestBody = ingenicoPayloadHelpers.createHostedCheckoutBody(paymentInstrument, order, requiresApproval, variantId, variantIdGuest, null);
    return ingenicoHelpers.createHostedCheckout(requestBody);
}

/**
 * Returns true if the payment status is completed, pending merchant or pending connect or 3rd party
 * @param {string} paymentStatus status of the payment
 * @returns {boolean} true if payment is not rejected or cancelled
 */
function isPaymentCompleted(paymentStatus) {
    return paymentStatus === 'PENDING_APPROVAL' || paymentStatus === 'PENDING_COMPLETION' || paymentStatus === 'PENDING_FRAUD_APPROVAL' ||
        paymentStatus === 'AUTHORIZATION_REQUESTED' || paymentStatus === 'CAPTURE_REQUESTED' || paymentStatus === 'PENDING_FRAUD_APPROVAL' ||
        paymentStatus === 'CAPTURED' || paymentStatus === 'PAID' || paymentStatus === 'CHARGEBACK_NOTIFICATION';
}

/**
 * Determine if the pay-by-link has already been paid, or if an existing session exists.
 * @param {dw.order.OrderPaymentInstrument} paymentInstrument of the order
 * @returns {PayByLinkStatus} status of the payment link
 */
function determinePayByLinkStatus(paymentInstrument) {
    if (isPaymentCompleted(paymentInstrument.getPaymentTransaction().custom.ingenicoResult)) {
        // if the customer has already paid, then redirect to a page with a message indicating that a customer has already paid
        return PayByLinkStatus.ALREADY_PAID;
    } else if (paymentInstrument.getPaymentTransaction().custom.ingenicoHostedCheckoutExpiryDate > new Date().valueOf()) {
        // a valid RPP session exists, but customer has not paid yet
        return PayByLinkStatus.RPP_SESSION_VALID;
    }
        // there is either no RPP session yet or the session has expired
    return PayByLinkStatus.NO_RPP_SESSION;
}

/**
 * Store Ingenico specific attributes on the payment transaction.
 * @param {dw.order.OrderPaymentInstrument} paymentInstrument of the order
 * @param {Object} checkoutResponse response of the hosted checkout
 * @param {string} redirectUrl of the hosted checkout
 */
function storePaymentTransactionDetails(paymentInstrument, checkoutResponse, redirectUrl) {
    const BigInteger = require('dw/util/BigInteger');

    Transaction.wrap(function storePaymentTransactionDetails() {
        paymentInstrument.getPaymentTransaction().custom.ingenicoHostedCheckoutId = checkoutResponse.hostedCheckoutId;
        // We set an expiry time of 1.5 hour for the current RPP session.
        // If a customer has not completed the payment within 1.5 hour, then we will create a new RPP session.
        const expiryDate = new BigInteger(new Date().valueOf().toFixed(0)).add(60 * 90 * 1000);
        paymentInstrument.getPaymentTransaction().custom.ingenicoHostedCheckoutExpiryDate = expiryDate;
        paymentInstrument.getPaymentTransaction().custom.ingenicoRedirect = redirectUrl;
        paymentInstrument.getPaymentTransaction().custom.ingenicoMerchantReference = checkoutResponse.merchantReference;
    });
}

/**
 * Determine the redirectUrl based on the PayByLink status
 * @param {PayByLinkStatus} payByLinkStatus status of the payment link
 * @param {dw.order.Order} order created in the Customer Service Center
 * @param {dw.order.OrderPaymentInstrument} paymentInstrument of the order
 * @returns {string} redirectUrl of the hosted checkout
 */
function getRedirectUrl(payByLinkStatus, order, paymentInstrument) {
    let redirectUrl = null;
    let checkoutResponse = null;
    switch (payByLinkStatus) {
        case PayByLinkStatus.RPP_SESSION_VALID:
            redirectUrl = paymentInstrument.getPaymentTransaction().custom.ingenicoRedirect;
            break;
        case PayByLinkStatus.NO_RPP_SESSION:
            checkoutResponse = createHostedCheckout(paymentInstrument, order);
            if (checkoutResponse == null || checkoutResponse.errors) {
                throw new Error('Unable to create payment for order with orderNo ' + order.orderNo);
            }
            redirectUrl = 'https://payment.' + checkoutResponse.partialRedirectUrl;
            storePaymentTransactionDetails(paymentInstrument, checkoutResponse, redirectUrl);
            break;
        default:
            throw new Error('Unknown PayByLink status');
    }
    return redirectUrl;
}

/**
 * Redirect to error page with provided error or message
 * @param {response} res response
 * @param {string} errorMessage error message
 */
function redirectToErrorPageForPayByLink(res, errorMessage) {
    const Resource = require('dw/web/Resource');
    const ingenicoLogger = require('dw/system/Logger').getLogger('Ingenico');

    ingenicoLogger.error('Error while redirecting to Pay by Link: {0}', errorMessage);

    res.render('/error', {
        message: Resource.msg('error.paybylink.error', 'ingenico', null)
    });
}

/**
 * Redirect to error page with order cancellation message
 * @param {response} res response
 */
function redirectToOrderCancellationPage(res) {
    const Resource = require('dw/web/Resource');

    res.render('/error', {
        message: Resource.msg('error.paybylink.order.cancelled', 'ingenico', null)
    });
}

/**
 * This function is used to redirect a customer to Ingenico's hosted payment pages.
 * The request must contains a hash with the order information.
 */
server.get('Redirect', server.middleware.https, function (req, res, next) {
    const parameterMap = request.httpParameterMap;
    const decryptedData = decryptHash(parameterMap);
    let paymentInstrument = null;

    if (!decryptedData) {
        redirectToErrorPageForPayByLink(res, 'Unable to decrypt payment link data');
    }

    try {
        const order = OrderMgr.getOrder(decryptedData.orderNumber, decryptedData.orderToken);
        if (!order) {
            redirectToErrorPageForPayByLink(res, 'Unable to find the payment instrument for orderNumber: ' + decryptedData.orderNumber);
        }

        if (order.getStatus().getDisplayValue() === 'CANCELLED') {
            redirectToOrderCancellationPage(res);
        } else {
            paymentInstrument = findPaymentInstrument(order);
            if (!paymentInstrument) {
                redirectToErrorPageForPayByLink(res, 'Unable to find the payment instrument with payment method: PAY_BY_LINK');
            }

            const payByLinkStatus = determinePayByLinkStatus(paymentInstrument);
            if (payByLinkStatus === PayByLinkStatus.ALREADY_PAID) {
                const ingenicoResponseHelpers = require('*/cartridge/scripts/ingenicoResponseHelpers');
                ingenicoResponseHelpers.renderConfirmationPage(res, order, 'already-paid');
                return next();
            }

            const redirectUrl = getRedirectUrl(payByLinkStatus, order, paymentInstrument);
            res.redirect(redirectUrl);
        }
    } catch (err) {
        redirectToErrorPageForPayByLink(res, err);
    }
    return next();
});

/**
 * Redirect a consumer to a retry page
 */
server.get('Retry', server.middleware.https, function (req, res, next) {
    const parameterMap = request.httpParameterMap;

    try {
        const order = OrderMgr.getOrder(parameterMap.ID, parameterMap.token);
        if (!order) {
            redirectToErrorPageForPayByLink(res, 'Unable to obtain the order for order number: ' + parameterMap.ID);
        }

        const paymentInstrument = findPaymentInstrument(order);
        if (!paymentInstrument) {
            redirectToErrorPageForPayByLink(res, 'Unable to find the payment instrument with payment method PAY_BY_LINK');
        }

        // clear all stored RPP session data
        Transaction.wrap(function () {
            paymentInstrument.getPaymentTransaction().custom.ingenicoHostedCheckoutId = null;
            paymentInstrument.getPaymentTransaction().custom.ingenicoHostedCheckoutExpiryDate = null;
            paymentInstrument.getPaymentTransaction().custom.ingenicoRedirect = null;
            paymentInstrument.getPaymentTransaction().custom.ingenicoMerchantReference = null;
            paymentInstrument.getPaymentTransaction().custom.ingenicoResult = null;
        });

        res.render('paybylink/retry', {
            paymentLink: paymentInstrument.getPaymentTransaction().custom.ingenicoPayByLinkUrl,
            isPaymentCancelled: parameterMap.paymentError.stringValue === 'PAYMENT-CANCELLED',
            isPaymentRejected: parameterMap.paymentError.stringValue === 'PAYMENT-NOT-VALID'
        });
    } catch (err) {
        redirectToErrorPageForPayByLink(res, err);
    }
    return next();
});

module.exports = server.exports();

