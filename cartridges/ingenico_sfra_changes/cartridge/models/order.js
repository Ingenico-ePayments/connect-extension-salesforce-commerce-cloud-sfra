'use strict';

var Resource = require('dw/web/Resource');
var base = module.superModule;

/**
 * Order class that represents the current order
 * @param {dw.order.LineItemCtnr} lineItemContainer - Current users's basket/order
 * @param {Object} options - The current order's line items
 * @param {Object} options.config - Object to help configure the orderModel
 * @param {string} options.config.numberOfLineItems - helps determine the number of lineitems needed
 * @param {string} options.countryCode - the current request country code
 * @constructor
 */
function OrderModel(lineItemContainer, options) {
    base.call(this, lineItemContainer, options);
    this.resources.paymentTypeApplePay = Resource.msg('ingenico.msg.payment.type.applepay', 'ingenico', null);
    this.resources.paymentTypeCreditCard = Resource.msg('ingenico.msg.payment.type.creditcard', 'ingenico', null);
    this.resources.paymentTypeGooglePay = Resource.msg('ingenico.msg.payment.type.googlepay', 'ingenico', null);
    this.resources.paymentTypeHostedCreditCard = Resource.msg('ingenico.msg.payment.type.hostedcreditcard', 'ingenico', null);
    this.resources.paymentTypeIdeal = Resource.msg('ingenico.msg.payment.type.ideal', 'ingenico', null);
    this.resources.paymentTypePayPal = Resource.msg('ingenico.msg.payment.type.paypal', 'ingenico', null);
    this.resources.paymentTypePaysafecard = Resource.msg('ingenico.msg.payment.type.paysafecard', 'ingenico', null);
    this.resources.paymentTypeSofort = Resource.msg('ingenico.msg.payment.type.sofort', 'ingenico', null);
    this.resources.paymentTypeTrustly = Resource.msg('ingenico.msg.payment.type.trustly', 'ingenico', null);
}

module.exports = OrderModel;
