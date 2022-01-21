'use strict';

/**
 * Get shipping methods for Apple Pay/Google Pay payment sheet
 * @param {Object} product the selected product
 * @param {number} productQuantity the selected quantity
 * @return {[]} a list of shipping methods
 */
function getShippingMethods(product, productQuantity) {
    const ShippingMgr = require('dw/order/ShippingMgr');
    const Money = require('dw/value/Money');

    const productShippingModel = ShippingMgr.getProductShippingModel(product);
    const shippingMethods = productShippingModel.getApplicableShippingMethods();
    let checkoutShippingMethods = [];
    for (let i = 0; i < shippingMethods.length; i++) {
        let shippingMethod = shippingMethods[i];
        let productShippingCost = productShippingModel.getShippingCost(shippingMethod)
            ? productShippingModel.getShippingCost(shippingMethod).getAmount().multiply(productQuantity)
            : new Money(0, product.getPriceModel().getPrice().getCurrencyCode());
        let totalAmount = product.getPriceModel().getPrice().multiply(productQuantity);
        let shippingCost = productShippingCost.add(ShippingMgr.getShippingCost(shippingMethod, totalAmount));

        checkoutShippingMethods.push({
            label: shippingMethod.displayName,
            detail: shippingMethod.description,
            amount: shippingCost.getValue(),
            identifier: shippingMethod.ID
        });
    }
    return checkoutShippingMethods;
}

/**
 * Check if payment method is enabled in Salesforce Commerce Cloud
 * @param {dw.util.List} activePaymentMethods list of active payment methods
 * @param {string} paymentMethod the chosen payment method
 * @return {boolean} true if payment method is enabled
 */
function isPaymentMethodEnabled(activePaymentMethods, paymentMethod) {
    for (let activePaymentMethod of activePaymentMethods.toArray()) {
        let paymentProcessor = activePaymentMethod.getPaymentProcessor();
        if (paymentMethod === activePaymentMethod.ID
            && paymentProcessor !== null
            && paymentProcessor.ID === 'INGENICO') {
            return true;
        }
    }
    return false;
}

/**
 * Calculate order amount excluding gift certificate payment instruments
 * @param {dw.order.Basket} basket of the order
 * @return {dw.value.Money} total gross price
 */
function getNonGiftCertificateAmount(basket) {
    const Money = require('dw/value/Money');

    let giftCertificateAmount = new Money(0, basket.getCurrencyCode());
    const paymentInstruments = basket.getGiftCertificatePaymentInstruments();
    let iterator = paymentInstruments.iterator();
    while (iterator.hasNext()) {
        let paymentInstrument = iterator.next();
        giftCertificateAmount = giftCertificateAmount.add(paymentInstrument.getPaymentTransaction().getAmount());
    }

    let totalGrossPrice = basket.getTotalGrossPrice();
    if (totalGrossPrice.getValue() > 0) {
        return totalGrossPrice.subtract(giftCertificateAmount);
    }
    return totalGrossPrice;
}

/**
 * Populate amount and locale to expressCheckoutData object
 * @param {Object} expressCheckoutData data object that needs to be populated
 * @param {dw.value.Money} amount of the basket
 * @param {dw.util.Locale} locale of the request
 */
function populateOrderData(expressCheckoutData, amount, locale) {
    const URLUtils = require('dw/web/URLUtils');
    expressCheckoutData.amount = amount.getValue();
    expressCheckoutData.currency = amount.getCurrencyCode();
    // Use Geolocation instead of locale to determine the countryCode
    expressCheckoutData.country = request.geolocation.countryCode || locale.getCountry();
    expressCheckoutData.locale = locale.getID();
    expressCheckoutData.clientSessionUrl = URLUtils.url('Ingenico-GetClientSession').toString();
    expressCheckoutData.csrfTokenUrl = URLUtils.url('CSRF-Generate').toString();
}

/**
 * Populate Google Pay specific data
 * @param {Object} expressCheckoutData data object that needs to be populated
 */
function populateGooglePaySpecificInput(expressCheckoutData) {
    const URLUtils = require('dw/web/URLUtils');
    const ingenicoPreferences = require('*/cartridge/scripts/ingenicoPreferences');
    const createApiService = require('*/cartridge/scripts/ingenicoApiService').create;
    const apiServiceCredential = createApiService().getConfiguration().getCredential();

    expressCheckoutData.googlePay = {
        googleEnvironment: apiServiceCredential.custom.ingenicoApiEnvironment.value === 'PROD' ? 'PRODUCTION' : 'TEST',
        googleMerchantId: ingenicoPreferences.getGoogleMerchantId(),
        googleMerchantName: ingenicoPreferences.getGoogleMerchantName(),
        ingenicoMerchantId: apiServiceCredential.custom.ingenicoMerchantId
    };
    expressCheckoutData.returnUrl = URLUtils.url('IngenicoExpressCheckout-Handle').toString();
}

/**
 * Populate Apple Pay specific data
 * @param {Object} expressCheckoutData data object that needs to be populated
 */
function populateApplePaySpecificInput(expressCheckoutData) {
    const URLUtils = require('dw/web/URLUtils');
    const ingenicoPreferences = require('*/cartridge/scripts/ingenicoPreferences');

    expressCheckoutData.applepay = {
        appleMerchantName: ingenicoPreferences.getAppleMerchantName()
    };
    expressCheckoutData.returnUrl = URLUtils.url('IngenicoExpressCheckout-Handle').toString();
}

/**
 * Populate payment method specific fields
 * @param {Object} expressCheckoutData data object that needs to be populated
 * @param {string} paymentMethod the chosen payment method
 */
function populatePaymentMethodSpecificInput(expressCheckoutData, paymentMethod) {
    if ('APPLE_PAY'.equals(paymentMethod)) {
        populateApplePaySpecificInput(expressCheckoutData);
    } else if ('GOOGLE_PAY'.equals(paymentMethod)) {
        populateGooglePaySpecificInput(expressCheckoutData);
    }
}

/**
 * Populate shipping methods
 * @param {Object} expressCheckoutData data object that needs to be populated
 * @param {dw.catalog.Product} product the selected product
 * @param {number} productQuantity the selected quantity
 */
function populateShippingMethodOptions(expressCheckoutData, product, productQuantity) {
    const shippingMethods = getShippingMethods(product, productQuantity);
    expressCheckoutData.shippingMethodOptions = shippingMethods;
}

/**
 * Populate product details
 * @param {Object} expressCheckoutData data object that needs to be populated
 * @param {dw.catalog.Product} product the selected product
 * @param {number} productQuantity quantity of the selected product
 */
function populateProductData(expressCheckoutData, product, productQuantity) {
    const TaxMgr = require('dw/order/TaxMgr');
    let taxRate = 0;
    if (TaxMgr.getTaxationPolicy() === TaxMgr.TAX_POLICY_NET) {
        // tax needs to be added to the product price
        taxRate = TaxMgr.getTaxRate(TaxMgr.getDefaultTaxClassID(), TaxMgr.getDefaultTaxJurisdictionID());
    }

    expressCheckoutData.product = {
        productId: product.getID().toString(),
        quantity: productQuantity,
        taxRate: taxRate
    };
}

/**
 * Get the details from product
 * @param {dw.catalog.Product} product the selected product
 * @param {number} productQuantity quantity of the product
 * @param {string} paymentMethod the chosen payment method
 * @return {Object} data
 */
function getDataFromProduct(product, productQuantity, paymentMethod) {
    const Locale = require('dw/util/Locale');
    const currentLocale = Locale.getLocale(request.locale);

    let expressCheckoutData = {};
    const productAmount = product.getPriceModel().getPrice().multiply(productQuantity);

    populateOrderData(expressCheckoutData, productAmount, currentLocale);
    populatePaymentMethodSpecificInput(expressCheckoutData, paymentMethod);
    populateProductData(expressCheckoutData, product, productQuantity);
    populateShippingMethodOptions(expressCheckoutData, product, productQuantity);
    return expressCheckoutData;
}

/**
 * Validate whether the basket contains other products than the given product
 * @param {dw.order.Basket} basket currentBasket
 * @param {string} productId id of the selected product
 * @return {boolean} true if there is another product in the basket than the current selected product
 */
function hasOtherProductsInBasket(basket, productId) {
    if (basket) {
        return basket.getProductLineItems().toArray().some(function (productLineItem) {
            return productLineItem.getProduct().getID() !== productId;
        });
    }
    return false;
}

/**
 * Get express checkout data from basket
 * @param {dw.order.Basket} basket currentBasket
 * @param {string} paymentMethod the chosen payment method
 * @return {Object} checkout data object for creating an express checkout payment
 */
function getDataFromBasket(basket, paymentMethod) {
    const Locale = require('dw/util/Locale');

    const orderAmount = getNonGiftCertificateAmount(basket);
    const currentLocale = Locale.getLocale(request.locale);

    let expressCheckoutData = {};
    populateOrderData(expressCheckoutData, orderAmount, currentLocale);
    populatePaymentMethodSpecificInput(expressCheckoutData, paymentMethod);
    return expressCheckoutData;
}

/**
 * Get the data needed for express checkout from basket or product
 * @param {string} paymentMethod the chosen payment method
 * @param {string|null} productId id of the selected product
 * @param {number|null} productQuantity quantity of the selected product
 * @return {Object|null} checkout data object for creating an express checkout payment
 */
function getIngenicoExpressCheckoutData(paymentMethod, productId, productQuantity) {
    const PaymentMgr = require('dw/order/PaymentMgr');
    const BasketMgr = require('dw/order/BasketMgr');

    let basket = BasketMgr.getCurrentBasket();

    if (!basket && !productId) {
        return null;
    }

    const activePaymentMethods = PaymentMgr.getActivePaymentMethods();
    if (!isPaymentMethodEnabled(activePaymentMethods, paymentMethod)) {
        return null;
    }

    if (productId) {
        const ProductMgr = require('dw/catalog/ProductMgr');
        const product = ProductMgr.getProduct(productId);

        let expressCheckoutData = getDataFromProduct(product, productQuantity, paymentMethod);
        if (expressCheckoutData.amount === 0) {
            // return null since no specific product has been selected
            return null;
        }
        if (expressCheckoutData.shippingMethodOptions == null || expressCheckoutData.shippingMethodOptions.length === 0) {
            // list of shipping methods cannot be empty
            return null;
        }
        expressCheckoutData.hasOtherProductsInBasket = hasOtherProductsInBasket(basket, productId);
        return expressCheckoutData;
    }
    return getDataFromBasket(basket, paymentMethod);
}

/**
 * Get the data needed for Apple Pay or Google Pay checkout
 * @param {string} paymentMethod the chosen payment method
 * @return {Object|null} checkout data object for creating an express checkout payment
 */
function getIngenicoCheckoutData(paymentMethod) {
    // Obtain the checkout data by calling getIngenicoExpressCheckoutData without product and quantity
    return getIngenicoExpressCheckoutData(paymentMethod, null, null);
}


module.exports = {
    getIngenicoExpressCheckoutData: getIngenicoExpressCheckoutData,
    getIngenicoCheckoutData: getIngenicoCheckoutData
};
