/* global request */
'use strict';

var HookMgr = require('dw/system/HookMgr');
var Logger = require('dw/system/Logger');
var ingenicoLogger = Logger.getLogger('Ingenico');
var Transaction = require('dw/system/Transaction');
var OrderMgr = require('dw/order/OrderMgr');
var StringUtil = require(request.httpHost ? '*/cartridge/scripts/util/StringUtil' : '../util/StringUtil');

var ATTEMPT_NUMBER_START_POSITION = 25;
var ATTEMPT_NUMBER_LENGTH = 5;

/**
 * get the paymentTransaction for a given transactionId
 * @param {Object} order Instance of dw.order.Order
 * @param {string} reference merchantReference of the transaction
 * @param {string} action The Ingenico action: "payment" | "refund"
 * @returns {Object} Instance of dw.order.PaymentTransaction
 */
function getPaymentTransaction(order, reference) {
    var collections = require('app_storefront_base/cartridge/scripts/util/collections');
    var result = null;

    if (!order) {
        return null;
    }
    collections.forEach(order.paymentInstruments, function (paymentInstrument) {
        if (paymentInstrument.paymentTransaction.custom.ingenicoMerchantReference === reference) {
            result = paymentInstrument.paymentTransaction;
        }
    });
    return result;
}

/**
 * extracted getOrder for testability
 * @param {string} orderNumber orderNumber
 * @returns {dw.order.Order} order
 */
function getOrder(orderNumber) {
    return OrderMgr.getOrder(orderNumber);
}

/**
 * Checks if a notification is more recent then the last processed notification for a paymentTransaction
 * @param {Object} paymentTransaction Instance of dw.order.PaymentTransaction
 * @param {Object} notification Instance of custom object type "ingenicoNotification"
 * @returns {boolean} true if the notification is more recent, otherwise false
 */
function isNotificationMoreRecent(paymentTransaction, notification) {
    var paymentTransactionSortKey = paymentTransaction.custom.ingenicoLastProcessedNotificationSortKey;
    var notificationSortKey = notification.custom.sortKey;

    if (!paymentTransactionSortKey) {
        return true;
    }

    return paymentTransactionSortKey < notificationSortKey;
}

/**
 * Checks if a new attempt exists for notificaiton
 * @param {Object} transactionIds  Array of transactionIds
 * @param {Object} currentNotification Instance of custom object type "ingenicoNotification"
 * @returns {boolean} true if there is a newer attempt
 */
function newAttemptInProgress(transactionIds, currentNotification) {
    var attemptNumber = Number(currentNotification.custom.transactionId.substring(ATTEMPT_NUMBER_START_POSITION)); // get the attempt number from transactionId
    var incrementedAttemptNumber = attemptNumber + 1;
    var paddedIncrementedAttemptNumber = StringUtil.padStart(ATTEMPT_NUMBER_LENGTH, incrementedAttemptNumber.toString(), '0');
    var incrementedTransactionId = currentNotification.custom.transactionId.substring(0, ATTEMPT_NUMBER_START_POSITION) + paddedIncrementedAttemptNumber;
    var isSecondAttempt = false;
    transactionIds.forEach(function (transactionId) {
        if (transactionId === incrementedTransactionId) {
            isSecondAttempt = true;
            return;
        }
    });
    return isSecondAttempt;
}

/**
 * Saves custom Ingenico properties on a transaction based on a transaction status update.
 * @param {dw.order.paymentTransaction} paymentTransaction paymentTransaction to save the properties on.
 * @param {Object} statusUpdate Update to apply on the transaction.
 * @param {string} action of the notification
 */
function saveIngenicoCustomProperties(paymentTransaction, statusUpdate, action) {
    if (action === 'payment') {
        paymentTransaction.custom.ingenicoTransactionAmount = statusUpdate.paymentOutput.amountOfMoney.amount;
        paymentTransaction.custom.ingenicoTransactionId = statusUpdate.id;
        paymentTransaction.custom.ingenicoResult = statusUpdate.status;
        paymentTransaction.custom.ingenicoIsCancellable = statusUpdate.statusOutput.isCancellable;
        paymentTransaction.custom.ingenicoIsRefundable = statusUpdate.statusOutput.isRefundable;
    }
}

/**
 * Get brand name based on payment product Id
 * @param {number} paymentProductId of the token
 * @returns {string} brandname
 */
function getBrandName(paymentProductId) {
    var Resource = require('dw/web/Resource');
    return Resource.msg('paymentProductId.' + paymentProductId + '.brandname', 'ingenico', 'credit card');
}

/**
 * Process token notification
 * @param {string} customerId of the customer
 * @param {string} notification that needs to be processed
 * @param {string} reference id of the token
 * @param {Object} payload of the notification
 * @param {string} eventType of the notification (e.g. token.created)
 * @param {string} createTime of the notification
 */
function processToken(customerId, notification, reference, payload, eventType, createTime) {
    var CustomerMgr = require('dw/customer/CustomerMgr');
    var Transaction = require('dw/system/Transaction');

    if (eventType !== 'token.deleted') {
        var customer = CustomerMgr.getCustomerByCustomerNumber(customerId);
        var wallet = customer.getProfile().getWallet();

        var paymentInstruments = wallet.getPaymentInstruments().toArray();
        var paymentToAdd = paymentInstruments.filter(function (paymentInstrument) {
            return reference === paymentInstrument.creditCardToken;
        })[0];

        if (paymentToAdd === undefined) {
            Transaction.wrap(function () {
                var paymentInstrument = wallet.createPaymentInstrument('HOSTED_CREDIT_CARD');
                var expirationYear = '20' + payload.card.data.cardWithoutCvv.expiryDate.substring(2);

                paymentInstrument.setCreditCardHolder(payload.card.data.cardWithoutCvv.cardholderName);
                paymentInstrument.setCreditCardNumber(payload.card.data.cardWithoutCvv.cardNumber);

                var brandName = getBrandName(payload.paymentProductId);
                paymentInstrument.setCreditCardType(brandName);
                paymentInstrument.setCreditCardExpirationMonth(Number(payload.card.data.cardWithoutCvv.expiryDate.substring(0, 2)));
                paymentInstrument.setCreditCardExpirationYear(Number(expirationYear));
                paymentInstrument.setCreditCardToken(payload.id);
            });
            ingenicoLogger.info('Processed webhook for customerId "{0}", reference number "{1}" and createTime {2}.', customerId, reference, createTime);
        } else {
            ingenicoLogger.debug('Token "{1}" already exists for customerId "{0}"\n', customerId, reference);
        }
    }
    // delete token is handled directly in PaymentInstrument.js
    Transaction.wrap(function () {
        notification.custom.processed = true;
    });
}
/**
 * Processes a single transaction with a status update notifications which will be deleted afterwards
 * @param {Object} transaction Describes the transaction to be updated
 * @param {string} transaction.id Merchant reference of the transaction
 * @param {Object[]} transaction.notifications Array of notifications to process
 */
function processTransaction(transaction) {
    // save the transactionIds so that it can be used later on for checking if multiple attempts exists
    var transactionIds = transaction.notifications.map(function (notification) {
        return notification.custom.transactionId;
    });
    transaction.notifications.forEach(function (notification, index) {
        var CustomObjectMgr = require('dw/object/CustomObjectMgr');
        var paymentTransaction;
        var order;
        var isLastItem = (index === transaction.notifications.length - 1);
        var lastItem = transaction.notifications[transaction.notifications.length - 1];
        var payload = JSON.parse(notification.custom.payload);
        var action = notification.custom.type.split('.')[0]; // payment | refund | token
        var hook = 'ingenico.transactionUpdate.' + action;
        var createTime = notification.custom.createTime;
        var orderNumber = notification.custom.orderNumber;
        var reference = notification.custom.reference;
        var merchantReference = notification.custom.merchantReference;
        var customerId = notification.custom.customerId; // used for processing tokens
        var secondsToExist = 10;
        var currentDateTime = new Date();
        currentDateTime.setSeconds(currentDateTime.getSeconds() - secondsToExist);
        currentDateTime = currentDateTime.toISOString().replace(/Z$/, '');
        var logDetails = '';

        var mode = {
            PROCESS: 0,
            IGNORE: 1,
            SKIP: 2
        };
        var processMode = mode.PROCESS;
        try {
            if (action === 'token') {
                processToken(customerId, notification, reference, payload, notification.custom.type, createTime);
            } else {
                // get the latest item of the batch and determine if it is older than 10 seconds,
                // if not, item of this batch must be skipped.
                if (lastItem.custom.sortKey > currentDateTime) {
                    processMode = mode.SKIP;
                } else if (notification.custom.processed) {
                // if the item has already been processed but not removed by SFCC
                    processMode = mode.SKIP;
                } else if (!isLastItem) {
                    processMode = mode.IGNORE;
                }

                order = module.exports.getOrder(orderNumber);

                if (processMode === mode.PROCESS) {
                // if last item is payment.cancelled, check if there is a new attempt for the order
                    if (notification.custom.type === 'payment.cancelled' && newAttemptInProgress(transactionIds, notification)) {
                        processMode = mode.IGNORE;
                    }

                    paymentTransaction = getPaymentTransaction(order, merchantReference);

                    if (!order) {
                        throw new Error('Order not found');
                    }

                    if (!paymentTransaction) {
                        throw new Error('PaymentTransaction not found');
                    }
                    if (!isNotificationMoreRecent(paymentTransaction, notification)) {
                        processMode = mode.IGNORE;
                    }
                }

                if (processMode === mode.PROCESS) {
                    Transaction.wrap(function () {
                        saveIngenicoCustomProperties(paymentTransaction, payload, action);
                        paymentTransaction.custom.ingenicoLastProcessedNotificationSortKey = notification.custom.sortKey;
                        order.trackOrderChange('Ingenico ' + action + ' update for transaction with ID ' + payload.id + ', status changed to ' + payload.status + '.');
                    });
                }

                if (processMode < mode.SKIP) {
                    if (processMode === mode.PROCESS) {
                        logDetails = 'PaymentTransaction custom fields have been updated and an orderChange was tracked.';
                    }

                    if (processMode === mode.IGNORE) {
                        logDetails = 'This webhook was ignored since a more recent webhook has been received.';
                        Transaction.wrap(function () {
                            order.trackOrderChange('The webhook of transaction with ID ' + payload.id + ' and status ' + payload.status + ' has been ignored since a more recent webhook has been received.');
                        });
                    }

                    ingenicoLogger.info('Processed webhook for order "{0}", reference number "{1}" and createTime {2}.\n{3}', orderNumber, reference, createTime, logDetails);
                    Transaction.wrap(function () {
                        notification.custom.processed = true;
                    });
                }

                if (processMode === mode.PROCESS && HookMgr.hasHook(hook)) {
                    HookMgr.callHook(hook, action, order, paymentTransaction, payload, {
                    // additional variables if needed
                    });
                    ingenicoLogger.debug('Successfully finished hook "{0}" for order "{1}", reference number "{2}" and createTime {3}', hook, orderNumber, reference, createTime);
                }
            }
        } catch (err) {
            if (action === 'token') {
                ingenicoLogger.error('Error processing webhook for customer "{0}", reference number "{1}" and createTime {2}.\nError: {3}\nThe webhook request body can be found in the custom debug log (category "Ingenico").', customerId, reference, createTime, err.message);
            } else {
                ingenicoLogger.error('Error processing webhook for order "{0}", reference number "{1}" and createTime {2}.\nError: {3}\nThe webhook request body can be found in the custom debug log (category "Ingenico").', orderNumber, reference, createTime, err.message);
            }
        } finally {
            try {
                if (notification.custom.processed) {
                    Transaction.wrap(function () {
                        CustomObjectMgr.remove(notification);
                    });
                }
            } catch (err) {
                ingenicoLogger.warn('Custom object "ingenicoNotification" could not be removed. Rooterror:{0}', err.message);
            }
        }
    });
}

/**
 * Processes and deletes all instances of custom object type "ingenicoNotification"
  */
function process() {
    var ingenicoWebhooks = require('../ingenicoWebhooks');
    var transactionsWithNotifications = ingenicoWebhooks.getTransactionsWithNotifications();

    transactionsWithNotifications.forEach(function (transaction) {
        processTransaction(transaction);
    });
}

module.exports = {
    process: process,
    getOrder: getOrder
};
