'use strict';

var server = require('server');
var CustomObjectMgr = require('dw/object/CustomObjectMgr');
var Transaction = require('dw/system/Transaction');
// var page = require('app_storefront_base/cartridge/controller/Test');

// server.extend(page);

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

module.exports = server.exports();
