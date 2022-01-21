/* global request */
'use strict';

var base = module.superModule;

var Locale = require('dw/util/Locale');

/**
 * @constructor
 * @classdesc totals class that represents the order totals of the current line item container
 *
 * @param {dw.order.LineItemCtnr} lineItemContainer - The current user's line item container
 */
function totals(lineItemContainer) {
    base.call(this, lineItemContainer);
    this.countryCode = Locale.getLocale(request.locale).getCountry();

    if (lineItemContainer) {
        this.unformattedTotal = {
            value: lineItemContainer.totalGrossPrice.value,
            currencyCode: lineItemContainer.totalGrossPrice.currencyCode
        };
    }
}

module.exports = totals;
