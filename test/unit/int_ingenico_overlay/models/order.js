'use strict';

var assert = require('chai').assert;

var Order = require('../../../mocks/models/order');

describe('Order', function () {
    it('should have Ingenico resource texts', function () {
        var result = new Order(null, null);
        assert.equal(result.resources.paymentTypeHostedCreditCard, 'ingenico.msg.payment.type.hostedcreditcard');
        assert.equal(result.resources.paymentTypeIdeal, 'ingenico.msg.payment.type.ideal');
        assert.equal(result.resources.paymentTypeTrustly, 'ingenico.msg.payment.type.trustly');
        assert.equal(result.resources.paymentTypePayPal, 'ingenico.msg.payment.type.paypal');
        assert.equal(result.resources.paymentTypeCreditCard, 'ingenico.msg.payment.type.creditcard');
    });
});
