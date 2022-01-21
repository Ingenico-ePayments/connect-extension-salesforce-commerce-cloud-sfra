'use strict';
var base = module.superModule;

var Locale = require('dw/util/Locale');

/**
 * CartModel class that represents the current basket
 *
 * @param {dw.order.Basket} basket - Current users's basket
 * @constructor
 */
function CartModel(basket) {
    base.call(this, basket);
    if (basket) {
        this.unformattedTotal = {
            value: basket.getTotalGrossPrice().getValue(),
            currencyCode: basket.getTotalGrossPrice().getCurrencyCode()
        };
        this.countryCode = Locale.getLocale(request.locale).getCountry();
    }
}

module.exports = CartModel;
