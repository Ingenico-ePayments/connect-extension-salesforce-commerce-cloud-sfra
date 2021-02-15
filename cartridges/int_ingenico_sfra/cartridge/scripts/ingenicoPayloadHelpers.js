'use strict';

var URLUtils = require('dw/web/URLUtils');
var Resource = require('dw/web/Resource');

var PAYMENT_PRODUCTS = {
    IDEAL: 809,
    TRUSTLY: 806,
    PAYPAL: 840
};

/**
 * Create shippingCart items
 * @param {dw.order.Order} order linked to the payment
 * @returns {Object} order object
 */
function createShoppingCart(order) {
    var collections = require('*/cartridge/scripts/util/collections');
    var ProductLineItem = require('dw/order/ProductLineItem');
    var ShippingLineItem = require('dw/order/ShippingLineItem');
    var PriceAdjustment = require('dw/order/PriceAdjustment');
    var ProductShippingLineItem = require('dw/order/ProductShippingLineItem');

    var items = collections.map(order.allLineItems, function (lineItem) {
        var grossPriceInCents = lineItem.grossPrice.value.toFixed(2).replace('.', '');

        if (lineItem instanceof ProductLineItem) {
            var pricePerItemInCents = (lineItem.grossPrice.value / lineItem.quantity).toFixed(2).replace('.', '');
            return {
                amountOfMoney: {
                    amount: grossPriceInCents,
                    currencyCode: lineItem.grossPrice.currencyCode
                },
                invoiceData: {
                    description: lineItem.productName,
                    nrOfItems: lineItem.quantity,
                    pricePerItem: pricePerItemInCents
                },
                orderLineDetails: {
                    lineAmountTotal: grossPriceInCents,
                    productPrice: pricePerItemInCents,
                    quantity: lineItem.quantity,
                    taxAmount: lineItem.tax
                }
            };
        } else if (lineItem instanceof ProductShippingLineItem || lineItem instanceof ShippingLineItem || lineItem instanceof PriceAdjustment) {
            var description = lineItem instanceof ShippingLineItem ? Resource.msg('label.order.shipping.cost', 'confirmation', null) : lineItem.lineItemText;
            return {
                amountOfMoney: {
                    amount: grossPriceInCents,
                    currencyCode: lineItem.grossPrice.currencyCode
                },
                invoiceData: {
                    description: description,
                    nrOfItems: 1,
                    pricePerItem: grossPriceInCents
                },
                orderLineDetails: {
                    lineAmountTotal: grossPriceInCents,
                    productPrice: grossPriceInCents,
                    quantity: 1,
                    taxAmount: lineItem.tax
                }
            };
        }
        return {};
    });

    return {
        items: items.filter(function (item) {
            return item !== undefined;
        })
    };
}

/**
 * Reverse string
 * @param {string} str to reverse
 * @returns {string} reversed string
 */
function reverseString(str) {
    return str.split('').reverse().join('');
}

/**
 * Split the address line as street, house number and addition info
 * @param {Array} addressLines that needs to be splitted
 * @returns {Object} splittedAddress
 */
function getSplittedAddress(addressLines) {
    var address = addressLines.join(' ');
    address = address.trim().replace('nº', '');

    // We reverse the address and the regex, so we start searching for the suffix, then the house number.
    // The remainder is considered to be the street name.
    address = reverseString(address);
    var matches = address.match('^([a-zA-Z\\-\\s]*)\\s*?(\\d+)\\s+(.*)$');
    if (matches && matches.length > 3) {
        return {
            additionalInfo: reverseString(matches[1].trim().replace(/^[\s,-]+|[\s,-]+$/, '')),
            houseNumber: reverseString(matches[2].trim()),
            street: reverseString(matches[3].trim().replace(/^[\s,-]+|[\s,-]+$/, ''))
        };
    }
    return {
        additionalInfo: '',
        houseNumber: '',
        street: reverseString(address)
    };
}

/**
 * Create address payload based on the address object
 * @param {string} address that is linked to the order
*  @returns {Object} address object
 */
function createAddress(address) {
    var splittedAddress = getSplittedAddress([address.address1, address.address2]);
    return {
        additionalInfo: splittedAddress.additionalInfo,
        city: address.city,
        countryCode: address.countryCode.value,
        street: splittedAddress.street,
        houseNumber: splittedAddress.houseNumber,
        state: address.stateCode,
        zip: address.postalCode
    };
}

/**
 * Create token payload based on card details and address object
 * @param {string} encryptedCustomerInput encrypted blob containing card and customer details
*  @returns {Object} token response
 */
function createTokenBody(encryptedCustomerInput) {
    var body = {
        encryptedCustomerInput: encryptedCustomerInput
    };
    return body;
}

/**
 * Create request body for order object.
 * @param {dw.order.PaymentInstrument} paymentInstrument containing the information of the payment
 * @param {dw.order.Order} order order linked to the payment
 * @returns {Object} order object
 */
function createOrderBody(paymentInstrument, order) {
    var merchantCustomerId = order.getCustomerNo() || 'Guest ' + order.getOrderNo();
    return {
        amountOfMoney: {
            currencyCode: paymentInstrument.paymentTransaction.amount.currencyCode,
            amount: paymentInstrument.paymentTransaction.amount.value.toFixed(2).replace('.', '')
        },
        customer: {
            billingAddress: createAddress(order.billingAddress),
            contactDetails: {
                emailAddress: order.customerEmail,
                phoneNumber: order.billingAddress.phone
            },
            locale: order.getCustomerLocaleID(),
            merchantCustomerId: merchantCustomerId,
            personalInformation: {
                name: {
                    firstName: order.billingAddress.firstName,
                    surname: order.billingAddress.lastName
                }
            }
        },
        references: {
            merchantReference: order.orderNo + '_' + new Date().valueOf()
        },
        shoppingCart: createShoppingCart(order),
        shipping: {
            address: createAddress(order.getDefaultShipment().shippingAddress),
            emailAddress: order.customerEmail
        }
    };
}

/**
 * Create a hosted checkout specific input object
 * @param {dw.order.Order} order order linked to the payment
 * @param {string} variantId of the hosted checkout for a registered customer flow
 * @param {string} variantIdGuest of the hosted checkout for a guest customer flow
 * @param {string} tokens a list of tokens that is stored on the customer account
 * @returns {Object} a hosted checkout specific input object
 */
function createHostedCheckoutSpecificInput(order, variantId, variantIdGuest, tokens) {
    return {
        variant: order.getCustomerNo() ? variantId : variantIdGuest,
        returnCancelState: true,
        showResultPage: false,
        paymentProductFilters: {
            restrictTo: {
                groups: ['cards']
            }
        },
        returnUrl: URLUtils.abs(
            'Ingenico-ShowConfirmation',
            'orderNo', order.orderNo,
            'orderToken', order.orderToken
        ).toString(),
        tokens: tokens
    };
}

/**
 * Create a card payment method specific input object
 * @param {dw.order.Order} order order linked to the payment
 * @param {boolean} requiresApproval indicates whether payment must be approved
 * @param {boolean} tokenize the payment
 * @param {string} token of the card
 * @returns {Object} a card payment method specific input object
 */
function createCardPaymentMethodSpecificInput(order, requiresApproval, tokenize, token) {
    var cardSpecificInput = {
        requiresApproval: requiresApproval,
        token: token,
        tokenize: tokenize,
        threeDSecure: {
            redirectionData: {
                returnUrl: URLUtils.abs(
                    'Ingenico-ShowConfirmation',
                    'orderNo', order.orderNo,
                    'orderToken', order.orderToken
                ).toString()
            }
        }
    };
    return cardSpecificInput;
}

/**
 * Create a hosted checkout object
 * @param {dw.order.PaymentInstrument} paymentInstrument containing the information of the payment
 * @param {dw.order.Order} order order linked to the payment
 * @param {boolean} requiresApproval indicates whether payment must be approved
 * @param {string} variantId of the hosted checkout for a registered customer flow
 * @param {string} variantIdGuest of the hosted checkout for a guest customer flow
 * @param {string} tokens a list of tokens that is stored on the customer account
 * @returns {Object} order object
 */
function createHostedCheckoutBody(paymentInstrument, order, requiresApproval, variantId, variantIdGuest, tokens) {
    return {
        order: createOrderBody(paymentInstrument, order),
        hostedCheckoutSpecificInput: createHostedCheckoutSpecificInput(order, variantId, variantIdGuest, tokens),
        cardPaymentMethodSpecificInput: createCardPaymentMethodSpecificInput(order, requiresApproval)
    };
}

/**
 * Create a redirect payment method specific input object
 * @param {boolean} order that is linked to the payment
 * @param {boolean} requiresApproval indicates whether payment must be approved
 * @param {Object} paymentMethodSpecificInput that is required for certain payment products
 * @param {number} paymentProductId of the payment
 * @returns {Object} a redirect payment method specific input object
 */
function createRedirectPaymentMethodSpecificInput(order, requiresApproval, paymentMethodSpecificInput, paymentProductId) {
    var payload = {
        redirectionData: {
            returnUrl: URLUtils.abs(
                'Ingenico-ShowConfirmation',
                'orderNo', order.orderNo,
                'orderToken', order.orderToken
            ).toString()
        },
        requiresApproval: requiresApproval,
        paymentProductId: paymentProductId
    };
    if (paymentProductId === PAYMENT_PRODUCTS.IDEAL) {
        payload.paymentProduct809SpecificInput = {
            issuerId: paymentMethodSpecificInput.issuerId
        };
    }
    return payload;
}

/**
 * Create a request body for a redirect payment method
 * @param {dw.order.PaymentInstrument} paymentInstrument containing the information of the payment
 * @param {dw.order.Order} order order linked to the payment
 * @param {boolean} requiresApproval indicates whether payment must be approved
 * @param {Object} paymentMethodSpecificInput that is required for certain payment products
 * @param {boolean} paymentProductId of the payment
 * @returns {Object} order object
 */
function createRedirectPaymentMethodBody(paymentInstrument, order, requiresApproval, paymentMethodSpecificInput, paymentProductId) {
    return {
        order: createOrderBody(paymentInstrument, order),
        redirectPaymentMethodSpecificInput: createRedirectPaymentMethodSpecificInput(order, requiresApproval, paymentMethodSpecificInput, paymentProductId)
    };
}

/**
 * Create a request body for a card payment method
 * @param {dw.order.PaymentInstrument} paymentInstrument containing the information of the payment
 * @param {dw.order.Order} order order linked to the payment
 * @param {boolean} requiresApproval indicates whether payment must be approved
 * @param {string} encryptedCustomerInput encrypted blob containing card details
 * @param {boolean} tokenize the payment transaction
 * @param {string} token of the card
 * @returns {Object} order object
 */
function createCardPaymentMethodBody(paymentInstrument, order, requiresApproval, encryptedCustomerInput, tokenize, token) {
    return {
        order: createOrderBody(paymentInstrument, order),
        cardPaymentMethodSpecificInput: createCardPaymentMethodSpecificInput(order, requiresApproval, tokenize, token),
        encryptedCustomerInput: encryptedCustomerInput
    };
}

module.exports = {
    createHostedCheckoutBody: createHostedCheckoutBody,
    createTokenBody: createTokenBody,
    createRedirectPaymentMethodBody: createRedirectPaymentMethodBody,
    createCardPaymentMethodBody: createCardPaymentMethodBody,
    PAYMENT_PRODUCTS: PAYMENT_PRODUCTS,

    /* expose for unit-testing */
    getSplittedAddress: getSplittedAddress
};
