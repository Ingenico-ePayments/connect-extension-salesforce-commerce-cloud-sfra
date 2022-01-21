'use strict';

const server = require('server');

/**
 * Find the Ingenico payment instrument of the order
 * @param {string} orderNumber of the order
 * @returns {dw.order.OrderPaymentInstrument} paymentTransaction
 */
function getIngenicoPaymentInstrument(orderNumber) {
    const OrderMgr = require('dw/order/OrderMgr');
    const order = OrderMgr.getOrder(orderNumber);
    const paymentInstruments = order.getPaymentInstruments().toArray()
        .filter(function (paymentInstrument) {
            return paymentInstrument.paymentTransaction.paymentProcessor.getID() === 'INGENICO';
        });
    return paymentInstruments.length > 0 ? paymentInstruments[0] : null;
}

/**
 * Save custom Ingenico Payment properties if the status has changed
 * @param {string} orderNumber of the order
 * @param {Object} payload of the result
 */
function saveIngenicoCustomPaymentProperties(orderNumber, payload) {
    const Transaction = require('dw/system/Transaction');
    const OrderMgr = require('dw/order/OrderMgr');
    const ingenicoResponseHelpers = require('*/cartridge/scripts/ingenicoResponseHelpers');

    const order = OrderMgr.getOrder(orderNumber);
    const paymentInstrument = getIngenicoPaymentInstrument(orderNumber);

    if (paymentInstrument) {
        Transaction.wrap(function () {
            if (paymentInstrument.paymentTransaction.custom.ingenicoResult !== payload.status) {
                // update the tracking history
                order.trackOrderChange('Ingenico payment update for transaction ID ' + paymentInstrument.paymentTransaction.custom.ingenicoTransactionId + ', status changed to ' + payload.status + '.');
            }
            ingenicoResponseHelpers.populatePaymentTransactionWithPaymentOutput(paymentInstrument.paymentTransaction, payload);
        });
    }
}

server.get('Action', function (req, res, next) {
    const ingenicoHelpers = require('*/cartridge/scripts/ingenicoHelpers');
    const OrderMgr = require('dw/order/OrderMgr');
    const Resource = require('dw/web/Resource');

    const action = req.querystring.action;
    let result;
    let order;
    let error = false;

    switch (action) {
        case 'paymentStatus':
            var paymentId = req.querystring.paymentId;
            var orderNumber = String(req.querystring.orderNumber);
            if (!paymentId) {
                // check if the ingenico payment status has been updated to PAID, webhook might arrive late
                order = OrderMgr.getOrder(orderNumber);
                var paymentInstrument = getIngenicoPaymentInstrument(orderNumber);
                if (paymentInstrument && paymentInstrument.paymentTransaction.custom.ingenicoResult === 'CAPTURE_REQUESTED') {
                    paymentId = paymentInstrument.paymentTransaction.custom.ingenicoTransactionId;
                    result = ingenicoHelpers.getPaymentStatus(paymentId);
                }
            } else {
                result = ingenicoHelpers.getPaymentStatus(paymentId);
            }
            if (result) {
                saveIngenicoCustomPaymentProperties(orderNumber, result);
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

