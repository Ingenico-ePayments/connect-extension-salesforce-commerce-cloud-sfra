var Site = require('dw/system/Site');

/**
 * @returns {string} apiService
 */
function getApiService() {
    var sitePreferences = Site.getCurrent().getPreferences();
    return sitePreferences.custom.ingenicoApiService;
}

/**
 * @returns {boolean} redirectRequiresApproval
 */
function getRedirectRequiresApproval() {
    var sitePreferences = Site.getCurrent().getPreferences();
    return sitePreferences.custom.ingenicoRedirectRequiresApproval;
}

/**
 * @returns {boolean} cardRequiresApproval
 */
function getCardRequiresApproval() {
    var sitePreferences = Site.getCurrent().getPreferences();
    return sitePreferences.custom.ingenicoCardRequiresApproval;
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

/**
 * @returns {string} merchant name that will used in Apple Pay payment sheet
 */
function getAppleMerchantName() {
    var sitePreferences = Site.getCurrent().getPreferences();
    return sitePreferences.custom.ingenicoAppleMerchantName;
}

/**
 * @returns {string} Apple Pay domain verification string
 */
function getApplePayDomainVerificationString() {
    var sitePreferences = Site.getCurrent().getPreferences();
    return sitePreferences.custom.ingenicoAppleDomainVerification;
}

/**
 * @returns {string} google merchant id for Google Pay
 */
function getGoogleMerchantId() {
    var sitePreferences = Site.getCurrent().getPreferences();
    return sitePreferences.custom.ingenicoGoogleMerchantId;
}

/**
 * @returns {string} merchant name that will used in Google Pay payment sheet
 */
function getGoogleMerchantName() {
    var sitePreferences = Site.getCurrent().getPreferences();
    return sitePreferences.custom.ingenicoGoogleMerchantName;
}

/**
 * @returns {string} secret key for encryption/decryption
 */
function getPayByLinkSecretKey() {
    var sitePreferences = Site.getCurrent().getPreferences();
    return sitePreferences.custom.ingenicoPayByLinkKey;
}

/**
 * @returns {string} iv for encryption/decryption
 */
function getPayByLinkSecretIV() {
    var sitePreferences = Site.getCurrent().getPreferences();
    return sitePreferences.custom.ingenicoPayByLinkIV;
}

/**
 * @returns {string} countryCode setting for payment validation
 */
function getCountryCodeSettingForPaymentValidation() {
    var sitePreferences = Site.getCurrent().getPreferences();
    return sitePreferences.custom.ingenicoCountryCodeForPayment.value;
}

module.exports = {
    getApiService: getApiService,
    getRedirectRequiresApproval: getRedirectRequiresApproval,
    getCardRequiresApproval: getCardRequiresApproval,
    getVariantId: getVariantId,
    getVariantIdGuest: getVariantIdGuest,
    getAppleMerchantName: getAppleMerchantName,
    getApplePayDomainVerificationString: getApplePayDomainVerificationString,
    getGoogleMerchantName: getGoogleMerchantName,
    getGoogleMerchantId: getGoogleMerchantId,
    getPayByLinkSecretKey: getPayByLinkSecretKey,
    getPayByLinkSecretIV: getPayByLinkSecretIV,
    getCountryCodeSettingForPaymentValidation: getCountryCodeSettingForPaymentValidation
};
