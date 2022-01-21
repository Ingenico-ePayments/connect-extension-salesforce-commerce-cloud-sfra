/* global request */
'use strict';

var server = require('server');

var CustomObjectMgr = require('dw/object/CustomObjectMgr');
var Transaction = require('dw/system/Transaction');

var clearCustomObjects = function clearCustomObjects(type) {
    var customObjects = CustomObjectMgr.getAllCustomObjects(type);
    Transaction.wrap(function () {
        while (customObjects.hasNext()) {
            var obj = customObjects.next();
            CustomObjectMgr.remove(obj);
        }
    });
};

server.post('Build', function (req, res, next) {
    var build = JSON.parse(req.body);
    var response = {};

    if (build.clear) {
        build.clear = typeof build.clear === 'boolean' ? ['ingenicoNotification'] : build.clear;
        build.clear.forEach(function (objectType) {
            clearCustomObjects(objectType);
        });
        response.cleared = true;
    }

    res.json({
        build: response
    });
    return next();
});

server.get('Notifications', function (req, res, next) {
    var notifications = CustomObjectMgr.queryCustomObjects('ingenicoNotification', 'custom.orderNumber = \'' + req.querystring.orderNo + '\'', 'creationDate');
    var response = {
        notifications: []
    };
    while (notifications.hasNext()) {
        var notification = notifications.next();
        response.notifications.push({
            id: notification.custom.id,
            type: notification.custom.type,
            reference: notification.custom.reference,
            createTime: notification.custom.createTime,
            sortKey: notification.custom.sortKey,
            processed: notification.custom.processed,
            payload: notification.custom.payload,
            orderNumber: notification.custom.orderNumber,
            transactionId: notification.custom.transactionId
        });
    }
    res.json(response);
    return next();
});

server.get('GetPaymentLink', function (req, res, next) {
    var OrderMgr = require('dw/order/OrderMgr');

    var orderNumber = request.httpParameterMap.orderNumber;
    var orderToken = request.httpParameterMap.orderToken;

    var order = OrderMgr.getOrder(orderNumber, orderToken);

    var paymentInstrument = order.getPaymentInstruments().toArray()
        .filter(function (pi) {
            return pi.paymentMethod === 'PAY_BY_LINK';
        })[0];

    var response = {
        orderNumber: orderNumber,
        orderToken: orderToken,
        paymentLink: paymentInstrument.paymentTransaction.custom.ingenicoPayByLinkUrl
    };
    res.json(response);
    return next();
});


server.post('UpdatePayment', function (req, res, next) {
    var Transaction = require('dw/system/Transaction');
    var OrderMgr = require('dw/order/OrderMgr');

    var orderNumber = request.httpParameterMap.orderNumber;
    var orderToken = request.httpParameterMap.orderToken;
    var paymentStatus = request.httpParameterMap.paymentStatus;
    var checkoutId = request.httpParameterMap.checkoutId;

    var order = OrderMgr.getOrder(orderNumber, orderToken);

    var paymentInstrument = order.getPaymentInstruments().toArray()
        .filter(function (pi) {
            return pi.paymentMethod === 'PAY_BY_LINK';
        })[0];

    Transaction.wrap(function () {
        paymentInstrument.paymentTransaction.custom.ingenicoHostedCheckoutId = checkoutId;
        paymentInstrument.paymentTransaction.custom.ingenicoResult = paymentStatus;
    });

    var response = {
        paymentLink: paymentInstrument.paymentTransaction.custom.ingenicoPayByLinkUrl
    };
    res.json(response);
    return next();
});

module.exports = server.exports();
