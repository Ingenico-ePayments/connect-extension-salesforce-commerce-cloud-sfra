
var AddressModel = require('*/cartridge/models/address');
var TotalsModel = require('*/cartridge/models/totals');
var ProductLineItems = require('*/cartridge/models/productLineItems');
var ShippingMethodModel = require('*/cartridge/models/shipping/shippingMethod');
var collections = require('app_storefront_base/cartridge/scripts/util/collections');
var ProductMgr = require('dw/catalog/ProductMgr');
var productDecorators = require('*/cartridge/models/product/decorators/index');
var productLineItemDecorators = require('*/cartridge/models/productLineItem/decorators/index');
var productHelper = require('*/cartridge/scripts/helpers/productHelpers');
var PromotionMgr = require('dw/campaign/PromotionMgr');

/**
 * Simplified version of the productModel found in SFRA.
 * The productModel cannot be used directly in a job because it uses the current session basket
 * This is just an example and should NOT be used directly
 * @param {dw.order.LineItem} lineItem Single lineItem to create a productModel for
 * @returns {Object} the simplified productModel
 */
function shallowProductModel(lineItem) {
    var apiProduct = ProductMgr.getProduct(lineItem.productID);
    var variationsPLI = productHelper.getVariationModel(apiProduct, null);
    if (variationsPLI) {
        apiProduct = variationsPLI.getSelectedVariant() || apiProduct; // eslint-disable-line
    }
    var optionModelPLI = apiProduct.optionModel;
    var optionLineItemsPLI = lineItem.optionProductLineItems;
    var currentOptionModelPLI = productHelper.getCurrentOptionModel(
        optionModelPLI,
        productHelper.getLineItemOptions(optionLineItemsPLI, lineItem.productID)
    );
    var lineItemOptionsPLI = optionLineItemsPLI.length
        ? productHelper.getLineItemOptionNames(optionLineItemsPLI)
        : productHelper.getDefaultOptions(optionModelPLI, optionModelPLI.options);
    var options = {
        productType: productHelper.getProductType(apiProduct),
        variationModel: variationsPLI,
        lineItemOptions: lineItemOptionsPLI,
        currentOptionModel: currentOptionModelPLI,
        lineItem: lineItem,
        quantity: lineItem.quantity.value,
        promotions: PromotionMgr.activeCustomerPromotions.getProductPromotions(apiProduct)
    };
    var product = {};

    productDecorators.base(product, apiProduct, options.productType);
    productDecorators.price(product, apiProduct, options.promotions, false, options.currentOptionModel);
    productDecorators.images(product, apiProduct, { types: ['small'], quantity: 'single' });
    productDecorators.variationAttributes(product, options.variationModel, {
        attributes: 'selected'
    });
    productDecorators.availability(product, options.quantity, apiProduct.minOrderQuantity.value, apiProduct.availabilityModel);

    productLineItemDecorators.quantity(product, options.quantity);
    productLineItemDecorators.gift(product, options.lineItem);
    productLineItemDecorators.appliedPromotions(product, options.lineItem);
    productLineItemDecorators.renderedPromotions(product); // must get applied promotions first
    productLineItemDecorators.uuid(product, options.lineItem);
    productLineItemDecorators.orderable(product, apiProduct, options.quantity);
    productLineItemDecorators.shipment(product, options.lineItem);
    productLineItemDecorators.bonusProductLineItem(product, options.lineItem);
    productLineItemDecorators.priceTotal(product, options.lineItem);
    productLineItemDecorators.quantityOptions(product, options.lineItem, options.quantity);
    productLineItemDecorators.options(product, options.lineItemOptions);
    productLineItemDecorators.bonusProductLineItemUUID(product, options.lineItem);
    productLineItemDecorators.preOrderUUID(product, options.lineItem);
    return product;
}

/**
 * Simplified version of the orderModel found in SFRA.
 * The orderModel cannot be used directly in a job because it uses the current session basket
 * This is just an example and should NOT be used directly
 * @param {dw.order.Order} order Order to create an orderModel for
 * @returns {Object} the simplified orderModel
 */
function shallowOrderModel(order) {
    return {
        orderNumber: order.orderNo,
        creationDate: order.creationDate,

        items: {
            items: collections.map(order.allProductLineItems, function (lineItem) {
                return shallowProductModel(lineItem);
            }),
            totalQuantity: ProductLineItems.getTotalQuantity(order.allProductLineItems)
        },
        shipping: collections.map(order.shipments, function (shipment) {
            return {
                isGift: shipment.gift,
                giftMessage: shipment.giftMessage,
                shippingAddress: new AddressModel(shipment.shippingAddress).address,
                selectedShippingMethod: shipment.shippingMethod ? new ShippingMethodModel(shipment.shippingMethod, shipment) : null,

                productLineItems: collections.map(shipment.productLineItems, function (lineItem) {
                    return shallowProductModel(lineItem);
                })
            };
        }),
        totals: new TotalsModel(order),

        billing: {
            billingAddress: new AddressModel(order.billingAddress),
            payment: {
                selectedPaymentInstruments: collections.map(order.paymentInstruments, function (paymentInstrument) {
                    return {
                        paymentMethod: paymentInstrument.paymentMethod
                    };
                })
            }
        }
    };
}


/**
 * gets the render html for the given isml template
 * @param {Object} templateContext - object that will fill template placeholders
 * @param {string} templateName - the name of the isml template to render.
 * @param {string} localeId - the localeId of the template to be rendered.
 * @returns {string} the rendered isml.
 */
function getRenderedHtml(templateContext, templateName, localeId) {
    var HashMap = require('dw/util/HashMap');
    var Template = require('dw/util/Template');
    var context = new HashMap();

    Object.keys(templateContext).forEach(function (key) {
        context.put(key, templateContext[key]);
    });

    var template = new Template(templateName, localeId);
    return template.render(context).text;
}

/**
 * Sends the confirmation email based on a shallow recreated orderModel.
 * This is needed because the normal orderModel cannot be instantiated in a job process.
 * This orderModel is an example implementation and a merchant should only load what it needs for the confirmation email
 * @param {dw.order.Order} order Order to create an orderModel for
 * @returns {void}
 */
function sendConfirmationMail(order) {
    var Mail = require('dw/net/Mail');
    var Resource = require('dw/web/Resource');
    var Site = require('dw/system/Site');

    var email = new Mail();
    email.addTo(order.customerEmail);
    email.setSubject(Resource.msg('subject.order.confirmation.email', 'order', null));
    email.setFrom(Site.current.getCustomPreferenceValue('customerServiceEmail') || 'no-reply@salesforce.com');
    email.setContent(getRenderedHtml({
        order: shallowOrderModel(order)
    }, 'checkout/confirmation/confirmationEmail', order.customerLocaleID), 'text/html', 'UTF-8');
    email.send();
}

module.exports = {
    shallowProductModel: shallowProductModel,
    shallowOrderModel: shallowOrderModel,
    sendConfirmationMail: sendConfirmationMail
};
