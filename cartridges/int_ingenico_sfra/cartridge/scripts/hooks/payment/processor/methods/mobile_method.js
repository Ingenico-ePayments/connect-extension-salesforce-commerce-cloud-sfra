'use strict';

const Transaction = require('dw/system/Transaction');

/**
 * Check if object is not empty.
 * @param {Object} object that needs to be validated
 * @return {boolean} true if object is not empty
 */
function isNotEmptyObject(object) {
    return object != null && Object.keys(object).length > 0;
}

/**
 * Update shipping address of the basket
 * @param {Object} shippingAddress returned by Apple or Google Pay
 * @param {dw.order.Shipment} orderShipping shipping object of the order
 */
function updateShippingAddress(shippingAddress, orderShipping) {
    Transaction.wrap(function () {
        let shipping = orderShipping.getShippingAddress() || orderShipping.createShippingAddress();
        shipping.setAddress1(shippingAddress.address1);
        shipping.setAddress2(shippingAddress.address2 || '');
        shipping.setCity(shippingAddress.city);
        shipping.setPostalCode(shippingAddress.postalCode);
        shipping.setCountryCode(shippingAddress.countryCode);
        shipping.setFirstName(shippingAddress.firstName);
        shipping.setLastName(shippingAddress.lastName);

        if (shippingAddress.phone) {
            shipping.setPhone(shippingAddress.phone);
        }
    });
}

/**
 * Update billing address of the basket
 * @param {Object} billingAddress returned by Apple or Google Pay
 * @param {dw.order.Basket} basket of the order
 */
function updateBillingAddress(billingAddress, basket) {
    Transaction.wrap(function () {
        let billing = basket.getBillingAddress() || basket.createBillingAddress();
        billing.setAddress1(billingAddress.address1);
        billing.setAddress2(billingAddress.address2 || '');
        billing.setCity(billingAddress.city);
        billing.setPostalCode(billingAddress.postalCode);
        billing.setCountryCode(billingAddress.countryCode);
        billing.setFirstName(billingAddress.firstName);
        billing.setLastName(billingAddress.lastName);

        if (billingAddress.phone) {
            billing.setPhone(billingAddress.phone);
        }
        if (billingAddress.email) {
            basket.setCustomerEmail(billingAddress.email);
        }
    });
}

/**
 * Update the shipping method of the basket
 * @param {string} shippingMethodId returned by Apple or Google Pay
 * @param {dw.order.Basket} basket of the order
 */
function updateShippingMethod(shippingMethodId, basket) {
    const ShippingMgr = require('dw/order/ShippingMgr');
    const shippingMethods = ShippingMgr.getAllShippingMethods().toArray();
    let selectedShippingMethod = shippingMethods.find(function (shippingMethod) {
        return shippingMethod.ID === shippingMethodId;
    });

    if (selectedShippingMethod) {
        Transaction.wrap(function () {
            basket.getDefaultShipment().setShippingMethod(selectedShippingMethod);
        });
    }
}

/**
 * Create payment instrument
 * @param {dw.order.Basket} basket of the order
 * @param {dw.web.HttpParameterMap} httpParameterMap of the request
 * @param {Object} paymentInformation containing the paymentMethod
 * @return {dw.order.PaymentInstrument} a payment instrument
 */
function createPaymentInstrument(basket, httpParameterMap, paymentInformation) {
    const PaymentMgr = require('dw/order/PaymentMgr');
    const Money = require('dw/value/Money');
    const paymentProcessor = PaymentMgr.getPaymentMethod(paymentInformation.paymentMethod.value).getPaymentProcessor();

    let paymentInstrument = null;
    let paymentInstruments = basket.getPaymentInstruments().toArray();
    const amount = new Money(httpParameterMap.amount, httpParameterMap.currencyCode);

    Transaction.wrap(function () {
        paymentInstruments.forEach(function (instrument) {
            basket.removePaymentInstrument(instrument);
        });

        paymentInstrument = basket.createPaymentInstrument(paymentInformation.paymentMethod.value, amount);
        paymentInstrument.paymentTransaction.setPaymentProcessor(paymentProcessor);
    });
    return paymentInstrument;
}

/**
 * Creates the correct paymentInstrument requested by the user.
 * @param {dw.order.Basket} basket Current user's basket
 * @param {Object} paymentInformation - the payment information
 * @return {Object} returns an object with error field
 */
function handle(basket, paymentInformation) {
    const httpParameterMap = request.httpParameterMap;
    const shippingAddress = httpParameterMap.shippingAddress !== undefined ? JSON.parse(httpParameterMap.shippingAddress.stringValue) : '';
    const billingAddress = httpParameterMap.billingAddress !== undefined ? JSON.parse(httpParameterMap.billingAddress.stringValue) : '';
    const shippingMethodId = httpParameterMap.shippingMethodId !== undefined ? httpParameterMap.shippingMethodId.stringValue : '';

    let paymentInstrument = createPaymentInstrument(basket, httpParameterMap, paymentInformation);

    if (!httpParameterMap.encryptedPaymentData || !httpParameterMap.encryptedPaymentData.stringValue || httpParameterMap.encryptedPaymentData.stringValue === '') {
        return { error: true };
    }

    if (!basket) {
        return { error: true };
    }

    if (isNotEmptyObject(shippingAddress)) {
        updateShippingAddress(shippingAddress, basket.getDefaultShipment());
    }

    if (isNotEmptyObject(billingAddress)) {
        updateBillingAddress(billingAddress, basket);
        basket.setCustomerEmail(billingAddress.email);
    }

    if (shippingMethodId) {
        updateShippingMethod(shippingMethodId, basket);
    }

    Transaction.wrap(function () {
        paymentInstrument.custom.ingenicoEncryptedCustomerInput = httpParameterMap.encryptedPaymentData.stringValue;
        paymentInformation.paymentInstrument = paymentInstrument;
    });

    return { success: true };
}

/**
 * Creates a payment via the Ingenico API
 * @param {dw.order.Order} order Order associated with the payment.
 * @param {dw.order.PaymentInstrument} paymentInstrument The payment instrument
 * @param {number} paymentProductId id of the chosen payment product
 */
function authorize(order, paymentInstrument, paymentProductId) {
    const ingenicoPayloadHelpers = require('*/cartridge/scripts/ingenicoPayloadHelpers');
    const ingenicoHelpers = require('*/cartridge/scripts/ingenicoHelpers');

    const requestBody = ingenicoPayloadHelpers.createMobilePaymentBody(paymentInstrument,
        order,
        paymentInstrument.custom.ingenicoEncryptedCustomerInput,
        paymentProductId);

    const paymentResponse = ingenicoHelpers.createPayment(requestBody);

    if (!paymentResponse.payment && !paymentResponse.paymentResult) {
        throw new Error('Unable to create a payment for order with orderNo ' + order.orderNo);
    }

    Transaction.wrap(function () {
        var payment = paymentResponse.payment || paymentResponse.paymentResult.payment;
        paymentInstrument.paymentTransaction.custom.ingenicoMerchantReference = payment.paymentOutput.references.merchantReference;
        paymentInstrument.paymentTransaction.custom.ingenicoTransactionId = payment.id;
        paymentInstrument.paymentTransaction.custom.ingenicoResult = payment.status;
    });
}

exports.handle = handle;
exports.authorize = authorize;
