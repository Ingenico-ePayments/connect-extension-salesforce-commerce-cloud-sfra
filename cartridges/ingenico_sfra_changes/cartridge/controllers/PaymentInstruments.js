'use strict';
/* global jQuery $ */

var server = require('server');

server.extend(module.superModule);

var csrfProtection = require('*/cartridge/scripts/middleware/csrf');
var userLoggedIn = require('*/cartridge/scripts/middleware/userLoggedIn');
var consentTracking = require('*/cartridge/scripts/middleware/consentTracking');

/**
 * Creates a list of expiration years from the current year
 * @returns {List} a plain list of expiration years from current year
 */
function getExpirationYears() {
    var currentYear = new Date().getFullYear();
    var creditCardExpirationYears = [];

    for (var i = 0; i < 10; i++) {
        creditCardExpirationYears.push((currentYear + i).toString());
    }

    return creditCardExpirationYears;
}

server.append(
    'AddPayment',
    csrfProtection.generateToken,
    consentTracking.consent,
    userLoggedIn.validateLoggedIn,
    function (req, res, next) {
        var URLUtils = require('dw/web/URLUtils');
        var Resource = require('dw/web/Resource');

        var creditCardExpirationYears = getExpirationYears();
        var paymentForm = server.forms.getForm('creditCard');
        var addressForm = server.forms.getForm('address');
        paymentForm.clear();
        addressForm.clear();

        var months = paymentForm.expirationMonth.options;
        for (var j = 0, k = months.length; j < k; j++) {
            months[j].selected = false;
        }
        res.render('account/payment/addPayment', {
            paymentForm: paymentForm,
            addressForm: addressForm,
            expirationYears: creditCardExpirationYears,
            breadcrumbs: [
                {
                    htmlValue: Resource.msg('global.home', 'common', null),
                    url: URLUtils.home().toString()
                },
                {
                    htmlValue: Resource.msg('page.title.myaccount', 'account', null),
                    url: URLUtils.url('Account-Show').toString()
                },
                {
                    htmlValue: Resource.msg('page.heading.payments', 'payment', null),
                    url: URLUtils.url('PaymentInstruments-List').toString()
                }
            ]
        });

        next();
    }
);

server.append('SavePayment', csrfProtection.validateAjaxRequest, function (req, res, next) {
    var HookMgr = require('dw/system/HookMgr');
    var PaymentMgr = require('dw/order/PaymentMgr');
    var URLUtils = require('dw/web/URLUtils');
    var Resource = require('dw/web/Resource');
    var CustomerMgr = require('dw/customer/CustomerMgr');
    var Transaction = require('dw/system/Transaction');
    var accountHelpers = require('*/cartridge/scripts/helpers/accountHelpers');

    var customerEncryptedInput = req.form.customerEncryptedInput;

    var processor = PaymentMgr.getPaymentMethod('HOSTED_CREDIT_CARD').getPaymentProcessor();
    var token = HookMgr.callHook(
                        'app.payment.processor.' + processor.ID.toLowerCase(),
                        'createToken',
                        customerEncryptedInput
                    );

    // store card details on customer account
    var customer = CustomerMgr.getCustomerByCustomerNumber(
        req.currentCustomer.profile.customerNo
    );

    var wallet = customer.getProfile().getWallet();
    var getTokenResponse = HookMgr.callHook(
        'app.payment.processor.' + processor.ID.toLowerCase(),
        'getToken',
        token
    );

    this.on('route:BeforeComplete', function () {
        Transaction.wrap(function () {
            var paymentInstrument = wallet.createPaymentInstrument('HOSTED_CREDIT_CARD');
            paymentInstrument.setCreditCardHolder(getTokenResponse.card.data.cardWithoutCvv.cardholderName);
            paymentInstrument.setCreditCardExpirationMonth(Number(getTokenResponse.card.data.cardWithoutCvv.expiryDate.substring(0, 2)));
            paymentInstrument.setCreditCardExpirationYear(Number('20' + getTokenResponse.card.data.cardWithoutCvv.expiryDate.substring(2)));
            paymentInstrument.setCreditCardNumber(getTokenResponse.card.data.cardWithoutCvv.cardNumber);

            // determine the card type based on payment product id
            var brandName = Resource.msg('paymentProductId.' + getTokenResponse.paymentProductId + '.brandname', 'ingenico', 'credit card');
            paymentInstrument.setCreditCardType(brandName);
            paymentInstrument.setCreditCardToken(token);
        });
    });

    // Send account edited email
    accountHelpers.sendAccountEditedEmail(customer.profile);

    res.json({
        success: true,
        redirectUrl: URLUtils.url('PaymentInstruments-List').toString()
    });
    return next();
});

server.append('DeletePayment', userLoggedIn.validateLoggedInAjax, function (req, res, next) {
    var array = require('*/cartridge/scripts/util/array');
    var accountHelpers = require('*/cartridge/scripts/helpers/accountHelpers');
    var HookMgr = require('dw/system/HookMgr');
    var PaymentMgr = require('dw/order/PaymentMgr');

    var data = res.getViewData();
    if (data && !data.loggedin) {
        res.json();
        return next();
    }

    var UUID = req.querystring.UUID;
    var paymentInstruments = req.currentCustomer.wallet.paymentInstruments;
    var paymentToDelete = array.find(paymentInstruments, function (item) {
        return UUID === item.UUID;
    });
    res.setViewData(paymentToDelete);
    this.on('route:BeforeComplete', function () { // eslint-disable-line no-shadow
        var CustomerMgr = require('dw/customer/CustomerMgr');
        var Transaction = require('dw/system/Transaction');
        var Resource = require('dw/web/Resource');

        var payment = res.getViewData();
        var customer = CustomerMgr.getCustomerByCustomerNumber(
            req.currentCustomer.profile.customerNo
        );
        var wallet = customer.getProfile().getWallet();
        var processor = PaymentMgr.getPaymentMethod('HOSTED_CREDIT_CARD').getPaymentProcessor();

        HookMgr.callHook(
            'app.payment.processor.' + processor.ID.toLowerCase(),
            'deleteToken',
            payment.raw.creditCardToken
        );
        Transaction.wrap(function () {
            wallet.removePaymentInstrument(payment.raw);
        });

        // Send account edited email
        accountHelpers.sendAccountEditedEmail(customer.profile);

        if (wallet.getPaymentInstruments().length === 0) {
            res.json({
                UUID: UUID,
                message: Resource.msg('msg.no.saved.payments', 'payment', null)
            });
        } else {
            res.json({ UUID: UUID });
        }
    });

    return next();
});

module.exports = server.exports();
