var Site = require('dw/system/Site');

/**
 * @returns {string} apiService
 */
function getApiService() {
    var sitePreferences = Site.getCurrent().getPreferences();
    return sitePreferences.custom.ingenicoApiService;
}

/**
 * @returns {boolean} requiresApproval
 */
function getRequiresApproval() {
    var sitePreferences = Site.getCurrent().getPreferences();
    return sitePreferences.custom.ingenicoRequiresApproval;
}

/**
 * @returns {string} variantId
 */
function getVariantId() {
    var sitePreferences = Site.getCurrent().getPreferences();
    return sitePreferences.custom.ingenicoVariantId;
}

/**
 * @returns {string} variantId for Guest Customer flow
 */
function getVariantIdGuest() {
    var sitePreferences = Site.getCurrent().getPreferences();
    return sitePreferences.custom.ingenicoVariantIdGuest;
}


module.exports = {
    getApiService: getApiService,
    getRequiresApproval: getRequiresApproval,
    getVariantId: getVariantId,
    getVariantIdGuest: getVariantIdGuest
};
