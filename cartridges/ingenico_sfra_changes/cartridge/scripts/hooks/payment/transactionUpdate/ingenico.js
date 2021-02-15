'use strict';

var Logger = require('dw/system/Logger');
var ingenicoLogger = Logger.getLogger('Ingenico');
var Order = require('dw/order/Order');
var OrderMgr = require('dw/order/OrderMgr');
var Transaction = require('dw/system/Transaction');

/**
 * Updates an order with a new Ingenico payment status.
 * @param {dw.order.Order} order Order containing the paymentInstrument that has been updated
 * @param {dw.order.PaymentTransaction} paymentTransaction Updated transaction
 */
function payment(order, paymentTransaction) {
    var placeOrderResult;
    var confirmationStatus = order.getConfirmationStatus();
    var COHelpers = require('app_storefront_base/cartridge/scripts/checkout/checkoutHelpers');
    var confirmationEmailHelper = require('../../../checkout/confirmationEmailHelper');

    switch (paymentTransaction.custom.ingenicoResult) {
        case 'CAPTURED': // Ingenico status with value CAPTURED/PAID/CAPTURE_REQUESTED means that the transaction has been paid and therefore the order can be shipped
        case 'PAID':
            if (order.getStatus().value === Order.ORDER_STATUS_CREATED) {
                placeOrderResult = COHelpers.placeOrder(order, {});
            }

            Transaction.wrap(function () {
                order.setPaymentStatus(Order.PAYMENT_STATUS_PAID);
            });

            if (placeOrderResult && placeOrderResult.error) {
                ingenicoLogger.error('Error placing order for orderNo {0}', order.orderNo);
                throw new Error('Error placing order for orderNo ' + order.orderNo);
            } else if (confirmationStatus.value === Order.CONFIRMATION_STATUS_NOTCONFIRMED) {
                confirmationEmailHelper.sendConfirmationMail(order);
            }
            break;
        case 'CAPTURE_REQUESTED':
            Transaction.wrap(function () {
                placeOrderResult = COHelpers.placeOrder(order, {});
                order.setPaymentStatus(Order.PAYMENT_STATUS_PAID);
            });

            if (placeOrderResult && placeOrderResult.error) {
                ingenicoLogger.error('Error placing order for orderNo {0}', order.orderNo);
                throw new Error('Error placing order for orderNo ' + order.orderNo);
            } else if (confirmationStatus.value === Order.CONFIRMATION_STATUS_NOTCONFIRMED) {
                confirmationEmailHelper.sendConfirmationMail(order);
            }
            break;
        case 'CHARGEBACK_NOTIFICATION': // Salesforce statuses unchanged
        case 'CHARGEBACKED':
        case 'REVERSED':
        case 'REFUNDED':
        case 'CREATED':
        case 'REDIRECTED':
        case 'PENDING_PAYMENT':
        case 'ACCOUNT_VERIFIED':
        case 'PENDING_APPROVAL':
        case 'PENDING_COMPLETION':
        case 'PENDING_CAPTURE':
        case 'PENDING_FRAUD_APPROVAL':
        case 'AUTHORIZATION_REQUESTED':
            break;
        case 'CANCELLED': // Ingenico status with value CANCELLED/REJECTED/REJECTED_CAPTURE means that the transaction has not been cancelled, and therefore the order cannot be shipped.
        case 'REJECTED':
        case 'REJECTED_CAPTURE':
            Transaction.wrap(function () {
                order.setPaymentStatus(Order.PAYMENT_STATUS_NOTPAID);
            });
            if (order.getStatus().value === Order.ORDER_STATUS_CREATED) {
                Transaction.wrap(function () {
                    OrderMgr.failOrder(order, false);
                });
            } else if (order.getStatus().value === Order.ORDER_STATUS_OPEN || order.getStatus().value === Order.ORDER_STATUS_NEW) {
                Transaction.wrap(function () {
                    OrderMgr.cancelOrder(order);
                });
            }
            // Check if this behaviour matches your business logic.
            break;
        default:
            ingenicoLogger.error('Unexpected status {0} in webhook for order {1}.', paymentTransaction.custom.ingenicoResult, order.orderNo);
            break;
    }
}

/**
 * updates an order with a new Ingenico refund status.
 * @param {dw.order.Order} order Order containing the paymentInstrument that has been updated
 * @param {dw.order.PaymentTransaction} refundTransaction Updated transaction
 * @param {Object} payload of the refund
 * @param {Object} additional Object containing extra data about the refund
 * @param {Object} additional.invoiceNumber invoice containing the transaction
 */
function refund(order, refundTransaction) {
    ingenicoLogger.debug('Refund hook not yet implemented, transaction UUID: {0}', refundTransaction.UUID);
}

module.exports = {
    payment: payment,
    refund: refund
};
