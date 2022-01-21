'use strict';

var server = require('server');

server.extend(module.superModule);
var csrfProtection = require('*/cartridge/scripts/middleware/csrf');
var consentTracking = require('*/cartridge/scripts/middleware/consentTracking');

server.append(
    'Confirm',
    consentTracking.consent,
    server.middleware.https,
    csrfProtection.generateToken,
    function (req, res, next) {
        var reportingUrlsHelper = require('*/cartridge/scripts/reportingUrls');
        var OrderMgr = require('dw/order/OrderMgr');
        var Locale = require('dw/util/Locale');
        var Resource = require('dw/web/Resource');
        var OrderModel = require('*/cartridge/models/order');

        if (!req.form.orderToken || !req.form.orderID) {
            res.render('/error', {
                message: Resource.msg('error.confirmation.error', 'confirmation', null)
            });

            return next();
        }

        var order = OrderMgr.getOrder(req.form.orderID, req.form.orderToken);

        var isOrderCreatedByCustomerService = false;
        order.getPaymentInstruments().toArray()
            .forEach(function (paymentInstrument) {
                if (paymentInstrument.getPaymentMethod() === 'PAY_BY_LINK') {
                    isOrderCreatedByCustomerService = true;
                    return;
                }
            });

        if (isOrderCreatedByCustomerService) {
            // no validation on customer since order is created from back office
            if (!order) {
                res.render('/error', {
                    message: Resource.msg('error.confirmation.error', 'confirmation', null)
                });
                return next();
            }

            var config = {
                numberOfLineItems: '*'
            };

            var currentLocale = Locale.getLocale(req.locale.id);

            var orderModel = new OrderModel(
                order,
                { config: config, countryCode: currentLocale.country, containerView: 'order' }
            );
            var passwordForm;

            var reportingURLs = reportingUrlsHelper.getOrderReportingURLs(order);


            if (!req.currentCustomer.profile) {
                passwordForm = server.forms.getForm('newPasswords');
                passwordForm.clear();
                res.render('checkout/confirmation/confirmation', {
                    order: orderModel,
                    returningCustomer: false,
                    passwordForm: passwordForm,
                    reportingURLs: reportingURLs
                });
            } else {
                res.render('checkout/confirmation/confirmation', {
                    order: orderModel,
                    returningCustomer: true,
                    reportingURLs: reportingURLs
                });
            }
            req.session.raw.custom.orderID = req.querystring.ID; // eslint-disable-line no-param-reassign
        }

        res.setViewData({
            message: req.form.message
        });
        return next();
    }
);

module.exports = server.exports();
