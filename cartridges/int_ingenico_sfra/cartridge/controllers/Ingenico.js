'use strict';

var server = require('server');
var URLUtils = require('dw/web/URLUtils');
var Transaction = require('dw/system/Transaction');
var OrderMgr = require('dw/order/OrderMgr');
var Logger = require('dw/system/Logger');
var ingenicoLogger = Logger.getLogger('Ingenico');

var csrfProtection = require('*/cartridge/scripts/middleware/csrf');
var consentTracking = require('*/cartridge/scripts/middleware/consentTracking');

var GCS_SIGNATURE_HEADER = 'x-gcs-signature';
var GCS_WEBHOOKS_VERIFICATION_HEADER = 'x-gcs-webhooks-endpoint-verification';

server.use('Notify', server.middleware.https, function (req, res, next) {
    var InvalidSecretError = require('../scripts/errors/InvalidSecretError');
    var InvalidSignatureError = require('../scripts/errors/InvalidSignatureError');
    var DuplicateWebhookError = require('../scripts/errors/DuplicateWebhookError');
    var ingenicoWebhooks = require('../scripts/ingenicoWebhooks');
    var requestLogDetails = '\nRequest Body: ' + req.body + '\nsignature: ' + req.httpHeaders[GCS_SIGNATURE_HEADER];
    var webhook;

    // Verification endpoint
    if (req.httpMethod === 'GET') {
        var verificationHeaderValue = req.httpHeaders[GCS_WEBHOOKS_VERIFICATION_HEADER];
        ingenicoLogger.debug('Received webhook endpoint verification request with verification header value ' + verificationHeaderValue);
        res.render('webhooks/verify', {
            verificationString: verificationHeaderValue
        });
        return next();
    } else if (req.httpMethod === 'POST') { // Parse webhook
        try {
            webhook = ingenicoWebhooks.parseWebhook(req);
        } catch (err) {
            var errorMessage;
            var errorType;
            var statusCode = 400;

            if (err instanceof InvalidSecretError) {
                errorType = 'InvalidSecretError';
                errorMessage = 'Error parsing webhook, invalid Webhooks secret. Possibly an invalid secret was used. Make sure "Ingenico Webhooks secret" in the Service Credentials is set';
            } else if (err instanceof InvalidSignatureError) {
                errorType = 'InvalidSignatureError';
                errorMessage = 'Error parsing webhook, invalid signature.';
            } else {
                statusCode = 500;
                errorType = 'UnhandledError';
                errorMessage = 'Error parsing webhook, unhandled exception';
            }

            ingenicoLogger.error(errorMessage + ' Set Log Level for "Ingenico" Custom Log Filter to "DEBUG" for more details.');
            ingenicoLogger.debug(errorMessage + '\nRoot error: ' + err.message + requestLogDetails);

            res.setStatusCode(statusCode);
            res.json({ success: false, error: errorType });
            return next();
        }

        // Persist webhook
        try {
            ingenicoWebhooks.persistWebhook(webhook);
        } catch (err) {
            if (err instanceof DuplicateWebhookError) {
                ingenicoLogger.debug('Warning parsing webhook. Duplicate webhook received, this webhook will be ignored. \nRoot error: ' + err.message + requestLogDetails);
                res.json({ success: true });
                return next();
            }

            // default error handling
            ingenicoLogger.error('Error parsing webhook. Set Log Level for "Ingenico" Custom Log Filter to "DEBUG" for more details.');
            ingenicoLogger.debug('Error parsing webhook. \nRoot error: ' + err.message + requestLogDetails);

            res.setStatusCode(200);
            res.json({ success: false, error: 'UnhandledError' });
            return next();
        }

        ingenicoLogger.debug('Received webhook, custom Object was created.' + requestLogDetails);

        res.json({
            success: true
        });
        return next();
    }
    return new Error('HTTP Method ' + req.method + ' is not supported');
});

/**
 * Determine the payment status category
 * @param {string} paymentStatus status of the payment
 * @returns {string} paymentStatusCategory
 */
function toPaymentCategory(paymentStatus) {
    var paymentStatusCategory;
    switch (paymentStatus) {
        case 'CREATED':
        case 'CANCELLED':
        case 'REJECTED':
        case 'REJECTED_CAPTURE':
            paymentStatusCategory = 'REJECTED';
            break;
        case 'REDIRECTED':
            paymentStatusCategory = 'STATUS_UNKNOWN';
            break;
        case 'PENDING_PAYMENT':
        case 'ACCOUNT_VERIFIED':
        case 'PENDING_APPROVAL':
        case 'PENDING_COMPLETION':
        case 'PENDING_FRAUD_APPROVAL':
        case 'AUTHORIZATION_REQUESTED':
        case 'CAPTURE_REQUESTED':
        case 'CAPTURED':
        case 'PAID':
        case 'CHARGEBACK_NOTIFICATION':
        case 'CHARGEBACKED':
        case 'REVERSED':
        case 'REFUNDED':
            paymentStatusCategory = 'SUCCESFUL';
            break;
        default:
            paymentStatusCategory = 'STATUS_UNKNOWN';
    }
    return paymentStatusCategory;
}

/**
 * Returns true if it is a  Pay By Link payment method
 * @param {dw.order.PaymentTransaction} paymentTransaction that is linked to the order
 * @returns {boolean} true if it is a PAY_BY_LINK payment method
 */
function isPayByLinkPaymentMethod(paymentTransaction) {
    return paymentTransaction.getPaymentInstrument().getPaymentMethod().equals('PAY_BY_LINK');
}

/**
 * Redirect customer to the correct page based on the checkout status
 * @param {response} res response
 * @param {dw.order.Order} order that is linked to the checkout
 * @param {dw.order.PaymentTransaction} paymentTransaction that is linked to the order
 * @param {Object} checkoutResult result object of the hosted checkout
 */
function handleCheckoutStatus(res, order, paymentTransaction, checkoutResult) {
    const ingenicoResponseHelpers = require('*/cartridge/scripts/ingenicoResponseHelpers');
    switch (checkoutResult.status) {
        case 'PAYMENT_CREATED':
            // payment created, but status might be rejected or unknown
            var paymentCategory = toPaymentCategory(checkoutResult.createdPaymentOutput.payment.status);
            if (paymentCategory === 'REJECTED') {
                if (isPayByLinkPaymentMethod(paymentTransaction)) {
                    res.redirect(URLUtils.url('IngenicoPayByLink-Retry', 'ID', order.orderNo, 'token', order.orderToken, 'paymentError', 'PAYMENT-NOT-VALID').toString());
                } else {
                    Transaction.wrap(function () {
                        OrderMgr.failOrder(order, true);
                    });
                    res.redirect(URLUtils.url('Checkout-Begin', 'stage', 'payment', 'paymentError', 'PAYMENT-NOT-VALID', 'checkout', null).toString());
                }
                break;
            } else if (paymentCategory === 'SUCCESFUL') {
                ingenicoResponseHelpers.renderConfirmationPage(res, order);
            } else {
                ingenicoResponseHelpers.renderConfirmationPage(res, order, 'unknown-payment-state');
            }
            break;
        case 'IN_PROGRESS':
            // redirect to confirmation page with unknown payment state
            ingenicoResponseHelpers.renderConfirmationPage(res, order, 'unknown-payment-state');
            break;
        case 'CANCELLED_BY_CONSUMER':
            // if it is pay-by-link RPP session, then redirect consumer to another page than the checkout page
            if (isPayByLinkPaymentMethod(paymentTransaction)) {
                res.redirect(URLUtils.url('IngenicoPayByLink-Retry', 'ID', order.orderNo, 'token', order.orderToken, 'paymentError', 'PAYMENT-CANCELLED').toString());
            } else {
                Transaction.wrap(function () {
                    OrderMgr.failOrder(order, true);
                });
                res.redirect(URLUtils.url('Checkout-Begin', 'stage', 'payment', 'paymentError', 'PAYMENT-CANCELLED', 'checkout', null).toString());
            }
            break;
        case 'CLIENT_NOT_ELIGIBLE_FOR_SELECTED_PAYMENT_PRODUCT':
        default:
            Transaction.wrap(function () {
                OrderMgr.failOrder(order, true);
            });
            res.redirect(URLUtils.url('Checkout-Begin', 'stage', 'payment', 'paymentError', 'PAYMENT-NOT-VALID', 'checkout', null).toString());
    }
}

/**
 * Redirects a customer to the correct page based on the payment status
 * @param {response} res response
 * @param {dw.order.Order} order that is linked to the payment
 * @param {Object} paymentStatus of the payment
 */
function handlePaymentStatus(res, order, paymentStatus) {
    const ingenicoResponseHelpers = require('*/cartridge/scripts/ingenicoResponseHelpers');
    var paymentCategory = toPaymentCategory(paymentStatus);
    if (paymentCategory === 'REJECTED') {
        Transaction.wrap(function () {
            OrderMgr.failOrder(order, true);
        });
        res.redirect(URLUtils.url('Checkout-Begin', 'stage', 'payment', 'paymentError', 'PAYMENT-NOT-VALID'));
    } else if (paymentCategory === 'SUCCESFUL') {
        ingenicoResponseHelpers.renderConfirmationPage(res, order);
    } else {
        ingenicoResponseHelpers.renderConfirmationPage(res, order, 'unknown-payment-state');
    }
}

server.get('ShowConfirmation', consentTracking.consent, csrfProtection.generateToken, server.middleware.https, function (req, res, next) {
    var ingenicoHelpers = require('*/cartridge/scripts/ingenicoHelpers');
    var ingenicoResponseHelpers = require('*/cartridge/scripts/ingenicoResponseHelpers');
    var order = OrderMgr.getOrder(req.querystring.orderNo, req.querystring.orderToken);
    var transaction;

    for (let paymentInstrument of order.paymentInstruments.toArray()) {
        if (paymentInstrument.paymentTransaction.custom.ingenicoHostedCheckoutId === req.querystring.hostedCheckoutId) {
            // hosted checkout flow
            transaction = paymentInstrument.paymentTransaction;
            break;
        } else if (paymentInstrument.paymentTransaction.custom.ingenicoTransactionId === req.querystring.REF &&
            paymentInstrument.paymentTransaction.custom.ingenicoRETURNMAC === decodeURIComponent(req.querystring.RETURNMAC)) {
            // inline redirect payment flow
            transaction = paymentInstrument.paymentTransaction;
            break;
        } else if (paymentInstrument.paymentTransaction.custom.ingenicoTransactionId &&
            (paymentInstrument.paymentTransaction.paymentInstrument.paymentMethod === 'CREDIT_CARD' ||
                paymentInstrument.paymentTransaction.paymentInstrument.paymentMethod === 'GOOGLE_PAY' ||
                paymentInstrument.paymentTransaction.paymentInstrument.paymentMethod === 'APPLE_PAY')) {
            // credit card inline payment flows
            transaction = paymentInstrument.paymentTransaction;
            break;
        }
    }

    if (!transaction) {
        throw new Error('Invalid response from server.');
    }

    if (transaction.custom.ingenicoHostedCheckoutId) {
        // get the hosted checkout status
        var checkoutResult = ingenicoHelpers.getHostedCheckoutStatus(req.querystring.hostedCheckoutId);
        if (checkoutResult.createdPaymentOutput) {
            Transaction.wrap(function () {
                ingenicoResponseHelpers.populatePaymentTransactionWithPaymentOutput(transaction, checkoutResult.createdPaymentOutput.payment);
            });
        }
        handleCheckoutStatus(res, order, transaction, checkoutResult);
    } else {
        var paymentStatus = transaction.custom.ingenicoResult;
        if (req.querystring.REF || transaction.custom.ingenicoTransactionId) {
            var paymentId = req.querystring.REF || transaction.custom.ingenicoTransactionId;
            var paymentResult = ingenicoHelpers.getPaymentStatus(paymentId);
            paymentStatus = paymentResult.status;
            Transaction.wrap(function () {
                ingenicoResponseHelpers.populatePaymentTransactionWithPaymentOutput(transaction, paymentResult);
            });
        }
        handlePaymentStatus(res, order, paymentStatus);
    }

    return next();
});

server.get('GetClientSession', function (req, res, next) {
    var ingenicoHelpers = require('*/cartridge/scripts/ingenicoHelpers');
    res.json(ingenicoHelpers.createClientSession());
    return next();
});

module.exports = server.exports();
