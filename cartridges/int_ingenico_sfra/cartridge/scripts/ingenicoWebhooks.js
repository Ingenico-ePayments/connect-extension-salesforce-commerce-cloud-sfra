'use strict';

var GCS_SIGNATURE_HEADER = 'x-gcs-signature';

/**
 * Parses a webhook request from Ingenico
 * @param {Object} request Incoming web hook request
 * @return {Object} Parsed body JSON from request
 */
function parseWebhook(request) {
    var InvalidSecretError = require('./errors/InvalidSecretError');
    var InvalidSignatureError = require('./errors/InvalidSignatureError');
    var ingenicoHelpers = require('*/cartridge/scripts/ingenicoHelpers');
    var Mac = require('dw/crypto/Mac');
    var Encoding = require('dw/crypto/Encoding');

    var secretKey = ingenicoHelpers.getIngenicoWebhooksSecret();
    if (!secretKey) {
        throw new InvalidSecretError('Webhooks secret was not configured. Make sure "Webhooks Secret" in the Service Credentials is set.');
    }

    var signature = request.httpHeaders[GCS_SIGNATURE_HEADER];
    if (!signature) {
        throw new InvalidSignatureError('Missing http header "' + GCS_SIGNATURE_HEADER + '"');
    }

    var encryptor = new Mac(Mac.HMAC_SHA_256);
    var signatureBytes = encryptor.digest(request.body, secretKey);
    var expectedSignature = Encoding.toBase64(signatureBytes);

    // Check if signature is valid
    if (expectedSignature !== signature) {
        throw new InvalidSignatureError('Invalid signature');
    }

    return JSON.parse(request.body);
}

/**
 * Saves a webhook to a custom object of type "ingenicoNotification"
 * @param {Object} webhook Object containing the body from the Ingenico webhook request
 */
function persistWebhook(webhook) {
    var DuplicateWebhookError = require('./errors/DuplicateWebhookError');
    var InvalidEventTypeError = require('./errors/InvalidEventTypeError');
    var CustomObjectMgr = require('dw/object/CustomObjectMgr');
    var Transaction = require('dw/system/Transaction');
    var Calendar = require('dw/util/Calendar');
    var payload;
    var orderNumber;
    var reference; // used for grouping notifications
    var merchantReference;
    var tokens;
    var customerId;

    // Check if the custom object already exists
    if (CustomObjectMgr.getCustomObject('ingenicoNotification', webhook.id) !== null) {
        throw new DuplicateWebhookError('Custom Object "ingenicoNotification" with event ID "' + webhook.id + '" already exists.');
    }

    // Determine the order number, creationdate of the transaction and payload
    var eventTypes = webhook.type.split('.');
    var eventType = eventTypes[0];
    var eventSubtype = eventTypes[1];
    switch (eventType) {
        case 'payment':
            payload = webhook.payment;
            reference = payload.paymentOutput.references.merchantReference;
            merchantReference = payload.paymentOutput.references.merchantReference;
            tokens = merchantReference.split('_');
            orderNumber = tokens[0];
            break;
        // case 'refund':
        // case 'payout': payload = webhook.payout; break;
        case 'token':
            payload = webhook.token;
            reference = payload.id;
            if (eventSubtype !== 'deleted') {
                customerId = payload.card.customer.merchantCustomerId;
            }
            break;
        default: throw new InvalidEventTypeError('Invalid type ' + eventType);
    }

    var calendar = new Calendar();
    calendar.parseByFormat(webhook.created, 'yyyy-MM-dd\'T\'HH:mm:ss.SSSZ');

    Transaction.wrap(function () {
        var customObject = CustomObjectMgr.createCustomObject('ingenicoNotification', webhook.id);
        customObject.custom.merchantId = webhook.merchantId;
        customObject.custom.transactionId = payload.id;
        customObject.custom.orderNumber = orderNumber;
        customObject.custom.merchantReference = merchantReference;
        customObject.custom.reference = reference;
        customObject.custom.customerId = customerId;
        customObject.custom.type = webhook.type;
        customObject.custom.createTime = calendar.getTime().toISOString();
        customObject.custom.sortKey = customObject.custom.createTime.replace(/Z$/, '');
        customObject.custom.processed = false;
        // SyntaxError will be thrown if the payload is invalid JSON
        customObject.custom.payload = JSON.stringify(payload);
    });
}

/**
 * returns an array containing all notifications
 * @return {Array} Array containing all custom objects of type "ingenicoNotification"
 */
function getTransactionsWithNotifications() {
    var CustomObjectMgr = require('dw/object/CustomObjectMgr');
    var notificationsQuery = CustomObjectMgr.queryCustomObjects('ingenicoNotification', '', 'custom.reference asc, custom.sortKey asc');
    var transactions = [];
    var transactionId = null;
    var transaction = null;
    var notification;

    while (notificationsQuery.hasNext()) {
        notification = notificationsQuery.next();

        if (transactionId !== notification.custom.reference) {
            // Save current transaction
            if (transaction) {
                transactions.push(transaction);
            }

            // New transaction
            transaction = {
                id: notification.custom.reference,
                notifications: []
            };
        }
        transactionId = notification.custom.reference;

        transaction.notifications.push(notification);
    }

    // Save last transaction
    if (transaction) {
        transactions.push(transaction);
    }

    return transactions;
}

module.exports = {
    parseWebhook: parseWebhook,
    persistWebhook: persistWebhook,
    getTransactionsWithNotifications: getTransactionsWithNotifications
};
