'use strict';

/* Script includes */
var server = require('server');

/**
 * Find the Ingenico payment instrument of the order
 * @param {string} orderNumber of the order
 * @returns {dw.order.PaymentTransaction} paymentTransaction
 */
function getIngenicoPaymentInstrument(orderNumber) {
    var OrderMgr = require('dw/order/OrderMgr');
    var order = OrderMgr.getOrder(orderNumber);
    var paymentInstruments = order.getPaymentInstruments();
    var iterator = paymentInstruments.iterator();
    var result;
    while (iterator.hasNext()) {
        var paymentInstrument = iterator.next();
        if (paymentInstrument.paymentTransaction.paymentProcessor.getID() === 'INGENICO') {
            result = paymentInstrument;
            break;
        }
    }
    return result;
}

/**
 * Save custom Ingenico Payment properties if the status has changed
 * @param {string} orderNumber of the order
 * @param {Object} payload of the result
 */
function saveIngenicoCustomPaymentProperties(orderNumber, payload) {
    var Transaction = require('dw/system/Transaction');
    var OrderMgr = require('dw/order/OrderMgr');
    var order = OrderMgr.getOrder(orderNumber);
    var result = getIngenicoPaymentInstrument(orderNumber);

    if (result.paymentTransaction.custom.ingenicoResult !== payload.status) {
        Transaction.wrap(function () {
            // update the tracking history
            order.trackOrderChange('Ingenico payment update for transaction ID ' + result.paymentTransaction.custom.ingenicoTransactionId + ', status changed to ' + payload.status + '.');

            result.paymentTransaction.custom.ingenicoResult = payload.status;
            result.paymentTransaction.custom.ingenicoIsCancellable = payload.statusOutput.isCancellable;
            result.paymentTransaction.custom.ingenicoIsRefundable = payload.statusOutput.isRefundable;
        });
    }
}

server.get('Action', function (req, res, next) {
    var ingenicoHelpers = require('*/cartridge/scripts/ingenicoHelpers');
    var OrderMgr = require('dw/order/OrderMgr');
    var Resource = require('dw/web/Resource');

    var action = req.querystring.action;
    var result;
    var order;
    var error = false;

    switch (action) {
        case 'paymentStatus':
            var paymentId = req.querystring.paymentId;
            if (!paymentId) {
                // check if the ingenico payment status has been updated to PAID, webhook might arrive late
                order = OrderMgr.getOrder(req.querystring.orderNumber);
                var paymentInstrument = getIngenicoPaymentInstrument(req.querystring.orderNumber);
                if (paymentInstrument.paymentTransaction.custom.ingenicoResult === 'CAPTURE_REQUESTED') {
                    paymentId = getIngenicoPaymentInstrument(req.querystring.orderNumber).paymentTransaction.custom.ingenicoTransactionId;
                    result = ingenicoHelpers.getPaymentStatus(paymentId);
                }
            } else {
                result = ingenicoHelpers.getPaymentStatus(paymentId);
            }
            if (result) {
                saveIngenicoCustomPaymentProperties(req.querystring.orderNumber, result);
            }
            break;
        case 'cancelPayment':
            result = ingenicoHelpers.cancelPayment(req.querystring.paymentId);
            break;
        case 'approvePayment':
            order = OrderMgr.getOrder(req.querystring.orderNumber);
            result = ingenicoHelpers.approvePayment(order, req.querystring.paymentId, req.querystring.amount);
            break;
        default:
            error = true;
            result = Resource.msg('error.action.unknown', 'ingenico', null);
    }
    if (result && result.errorId) {
        error = true;
    }
    res.json({ error: error, json: result });

    next();
});

module.exports = server.exports();

