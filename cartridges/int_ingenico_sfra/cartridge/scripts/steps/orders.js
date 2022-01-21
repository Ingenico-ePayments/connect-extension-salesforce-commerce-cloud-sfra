/* global request */
'use strict';

var OrderMgr = require('dw/order/OrderMgr');
var Order = require('dw/order/Order');

/**
 * Fail order if hosted checkout session of created order has already been expired.
 * @param {dw.order.Order} order created order
 */
function failOrderIfExpired(order) {
    var ingenicoHelpers = require(request.httpHost ? '*/cartridge/scripts/ingenicoHelpers' : '../ingenicoHelpers');
    var millisecondsToExist = 3600 * 2 * 1000; // hosted checkout session is 2 hours valid

    var localDateTime = new Date();
    var utcDateTime = new Date(localDateTime.toUTCString());
    var expiryDate = (utcDateTime.valueOf()) - millisecondsToExist;
    var creationDateUTC = new Date(order.creationDate.toUTCString()).valueOf();

    if (creationDateUTC <= expiryDate) {
        for (let paymentInstrument of order.getPaymentInstruments().toArray()) {
            if (paymentInstrument.paymentTransaction.paymentProcessor.getID() === 'INGENICO' && paymentInstrument.paymentTransaction.custom.ingenicoHostedCheckoutId) {
                var checkoutStatus = ingenicoHelpers.getHostedCheckoutStatus(paymentInstrument.paymentTransaction.custom.ingenicoHostedCheckoutId);
                if (checkoutStatus.errorId && checkoutStatus.errors[0].httpStatusCode === 404) {
                    OrderMgr.failOrder(order, false);
                }
                break;
            }
        }
    }
}

/**
 * Processes created orders for which the hosted checkout session is expired
  */
function process() {
    OrderMgr.processOrders(failOrderIfExpired, 'status = {0}', Order.ORDER_STATUS_CREATED);
}

module.exports = {
    process: process
};
