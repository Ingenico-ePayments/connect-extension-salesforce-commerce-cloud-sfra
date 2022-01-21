'use strict';

const Status = require('dw/system/Status');
const ingenicoLogger = require('dw/system/Logger').getLogger('Ingenico');

/**
 * @returns {Object} returns an error object
 */
function handle() {
    return { error: false };
}

/**
 * Generate a payment link based on the order information
 * @param {dw.order.Order} order created in Customer Service Center
 * @param {dw.order.OrderPaymentInstrument} paymentInstrument of the order
 */
function generatePaymentLink(order, paymentInstrument) {
    const Transaction = require('dw/system/Transaction');

    const Encoding = require('dw/crypto/Encoding');
    const Cipher = require('dw/crypto/Cipher');
    const Bytes = require('dw/util/Bytes');
    const HookMgr = require('dw/system/HookMgr');
    const URLUtils = require('dw/web/URLUtils');
    const ingenicoPreferences = require('*/cartridge/scripts/ingenicoPreferences');

    const secretKey = Encoding.toBase64(new Bytes(ingenicoPreferences.getPayByLinkSecretKey()));
    const iv = Encoding.toBase64(new Bytes(ingenicoPreferences.getPayByLinkSecretIV()));
    const transformation = 'AES/CBC/PKCS5Padding';
    const iterations = 10;

    var paymentLinkData = {
        orderNumber: order.getOrderNo(),
        orderToken: order.getOrderToken()
    };

    var cipher = new Cipher();
    var encryptedData = cipher.encrypt(JSON.stringify(paymentLinkData), secretKey, transformation, iv, iterations);
    var encodedHash = Encoding.toBase64(new Bytes(encryptedData));

    var paymentLink = URLUtils.https('IngenicoPayByLink-Redirect', 'id', encodedHash).toString();

    Transaction.wrap(function () {
        paymentInstrument.getPaymentTransaction().custom.ingenicoPayByLinkUrl = paymentLink;
    });

    ingenicoLogger.info('Payment link has been created for order number: {0}', order.getOrderNo());

    if (HookMgr.hasHook('ingenico.paymentLink')) {
        HookMgr.callHook('ingenico.paymentLink', 'handlePaymentLink', paymentLink);
    }
}

/**
 * Generate a payment link in case of a PAY_BY_LINK payment method
 * @param {dw.order.Order} order created in the Customer Service Center
 * @param {dw.order.OrderPaymentInstrument} paymentInstrument of the order
 * @returns {dw.system.Status} status OK status
 */
function authorize(order, paymentInstrument) {
    if (paymentInstrument.getPaymentMethod() === 'PAY_BY_LINK') {
        generatePaymentLink(order, paymentInstrument);
    }
    return new Status(Status.OK);
}

exports.handle = handle;
exports.authorize = authorize;
