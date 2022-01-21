'use strict';

var server = require('server');

server.extend(module.superModule);

server.append('SubmitPayment', function (req, res, next) {
    var viewData = res.getViewData();
    if (viewData.error) {
        return next();
    }
    var PaymentMgr = require('dw/order/PaymentMgr');
    var paymentForm = server.forms.getForm('billing');

    if (!paymentForm.paymentMethod.valid) {
        return next();
    }

    var processor = PaymentMgr.getPaymentMethod(paymentForm.paymentMethod.htmlValue).getPaymentProcessor();
    if (processor.ID === 'INGENICO') {
        if (viewData.paymentMethod.value === 'IDEAL') {
            viewData.paymentInformation.ingenicoIssuerId = {
                value: paymentForm.idealFields.issuerId.value
            };
        } else if (viewData.paymentMethod.value === 'CREDIT_CARD') {
            viewData.paymentInformation.ingenicoEncryptedCustomerInput = {
                value: paymentForm.creditCardFields.encryptedCustomerInput.htmlValue
            };
            viewData.paymentInformation.storedPaymentUUID = {
                value: req.form.storedPaymentUUID
            };
            viewData.paymentInformation.saveCard = {
                value: paymentForm.creditCardFields.saveCard.checked
            };
        }
    }
    return next();
});

server.append('PlaceOrder', function (req, res, next) {
    var viewData = res.getViewData();
    if (viewData.error) {
        return next();
    }
    var COHelpers = require('*/cartridge/scripts/checkout/checkoutHelpers');
    var Transaction = require('dw/system/Transaction');
    var Resource = require('dw/web/Resource');
    var URLUtils = require('dw/web/URLUtils');
    var OrderMgr = require('dw/order/OrderMgr');
    var order = OrderMgr.getOrder(viewData.orderID, viewData.orderToken);
    if (!COHelpers.isIngenicoOrder(order)) {
        return next();
    }

    var exclusivePaymentResponse;
    for (let paymentInstrument of order.paymentInstruments.toArray()) {
        if (paymentInstrument.paymentTransaction.custom.ingenicoRedirect) {
            if (exclusivePaymentResponse) { // Cannot have two redirect targets
                Transaction.wrap(function () { OrderMgr.failOrder(order, true); });
                res.json({
                    error: true,
                    errorMessage: Resource.msg('error.technical', 'checkout', null)
                });
                return next();
            }
            exclusivePaymentResponse = {
                error: false,
                orderID: order.orderNo,
                orderToken: order.orderToken,
                continueUrl: paymentInstrument.paymentTransaction.custom.ingenicoRedirect
            };
        } else if (paymentInstrument.paymentMethod === 'CREDIT_CARD' || paymentInstrument.paymentMethod === 'GOOGLE_PAY' || paymentInstrument.paymentMethod === 'APPLE_PAY') {
            exclusivePaymentResponse = {
                error: false,
                orderID: order.orderNo,
                orderToken: order.orderToken,
                continueUrl: URLUtils.abs(
                    'Ingenico-ShowConfirmation',
                    'orderNo', order.orderNo,
                    'orderToken', order.orderToken
                ).toString()
            };
        }
    }

    if (exclusivePaymentResponse) {
        res.json(exclusivePaymentResponse);
    }
    return next();
});

module.exports = server.exports();
