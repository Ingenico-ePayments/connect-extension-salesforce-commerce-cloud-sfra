'use strict';

const server = require('server');
const URLUtils = require('dw/web/URLUtils');
const Logger = require('dw/system/Logger');
const ingenicoLogger = Logger.getLogger('Ingenico');

const Transaction = require('dw/system/Transaction');
const OrderMgr = require('dw/order/OrderMgr');

const csrfProtection = require('*/cartridge/scripts/middleware/csrf');

/**
 * Redirect customer to checkout page
 * @param {response} res response
 */
function handleCheckoutFromCart(res) {
    res.redirect(URLUtils.url('Checkout-Begin', 'stage', 'placeOrder', 'isFromCart', true).toString());
}

/**
 * Fail the order in case of errors, otherwise redirect the customer to the confirmation page.
 * @param {Object} paymentResult of the express checkout payment
 * @param {dw.order.Order} order of the payment
 * @param {response} res response
 */
function handlePaymentResult(paymentResult, order, res) {
    if (paymentResult && paymentResult.error) {
        // fail order
        Transaction.wrap(function () {
            OrderMgr.failOrder(order, true);
        });
        res.redirect(URLUtils.url('Checkout-Begin', 'stage', 'payment', 'paymentError', 'PAYMENT-NOT-VALID').toString());
    } else {
        res.redirect(URLUtils.url('Ingenico-ShowConfirmation', 'orderNo', order.orderNo, 'orderToken', order.orderToken).toString());
    }
}

/**
 * Create a new order, and then redirect the customer to the confirmation page
 * @param {response} res response
 * @param {dw.order.Basket} basket of the order
 */
function handleCheckout(res, basket) {
    // if apple pay or google pay is initiated from checkout page, then we'll need to create the order and show the confirmation page
    const COHelpers = require('*/cartridge/scripts/checkout/checkoutHelpers');

    // Creates a new order.
    const order = COHelpers.createOrder(basket);
    if (!order) {
        res.redirect(URLUtils.url('Cart-Show').toString());
    }

    // Handles payment authorization
    const paymentResult = COHelpers.handlePayments(order, order.orderNo);
    handlePaymentResult(paymentResult, order, res);
}

/**
 * Remove all product line items from the basket
 * @param {dw.order.Basket} basket currentBasket
 */
function removeAllProductLineItemsFromBasket(basket) {
    const Transaction = require('dw/system/Transaction');
    const items = basket.getAllProductLineItems();
    Transaction.wrap(function () {
        items.toArray().forEach(item => basket.removeProductLineItem(item));
    });
}

/**
 * Add the product to the basket and set the quantity
 * @param {dw.order.Basket} basket currentBasket
 * @param {string} productId id of the selected product
 * @param {number} productQuantity selected quantity of the product
 */
function addProductToBasket(basket, productId, productQuantity) {
    const Transaction = require('dw/system/Transaction');
    Transaction.wrap(function () {
        let productLineItem = basket.createProductLineItem(productId, basket.getDefaultShipment());
        productLineItem.setQuantityValue(productQuantity);
    });
}

server.post('Handle', server.middleware.https, csrfProtection.validateAjaxRequest, function (req, res, next) {
    const BasketMgr = require('dw/order/BasketMgr');
    let basket = BasketMgr.getCurrentBasket();
    const productId = req.httpParameterMap.productId.stringValue;

    if (!basket && productId) {
        // create empty basket
        basket = BasketMgr.getCurrentOrNewBasket();
    } else if (basket && productId) {
        // remove all items from basket and add the product to the basket
        removeAllProductLineItemsFromBasket(basket);
    }

    if (productId && productId.length > 0) {
        addProductToBasket(basket, productId, req.httpParameterMap.productQuantity.intValue);
    }

    let processorHandle = null;
    let paymentInformation = {
        paymentMethod: {
            value: req.httpParameterMap.paymentMethod.stringValue
        }
    };

    try {
        // eslint-disable-next-line new-cap
        processorHandle = require('*/cartridge/scripts/hooks/payment/processor/ingenico').Handle(basket, paymentInformation);
        if (processorHandle && processorHandle.error !== false) {
            res.redirect(URLUtils.url('Cart-Show').toString());
        } else if (req.httpParameterMap.isFromCheckout.stringValue === 'true') {
            handleCheckout(res, basket);
        } else if (req.httpParameterMap.isFromCheckout.stringValue === 'false') {
            handleCheckoutFromCart(res);
        }
    } catch (error) {
        ingenicoLogger.error(error);
        res.redirect(URLUtils.url('Cart-Show').toString());
    }
    return next();
});

server.get('ExpressCheckoutData', server.middleware.https, function (req, res, next) {
    const ingenicoCheckoutHelpers = require('*/cartridge/scripts/checkout/ingenicoCheckoutHelper');

    if (!req.querystring.paymentMethod || !req.querystring.productId || !req.querystring.productQuantity) {
        return null;
    }

    const ingenicoOrderDetails = ingenicoCheckoutHelpers.getIngenicoExpressCheckoutData(req.querystring.paymentMethod, req.querystring.productId, req.querystring.productQuantity);
    if (ingenicoOrderDetails == null) {
        res.json({});
    } else {
        res.json(ingenicoOrderDetails);
    }
    return next();
});

module.exports = server.exports();
