'use strict';

/**
 * Mask field with value
 * @param {string} key of the field
 * @param {string} value of the field
 * @returns {string} masked value
 */
function mask(key, value) {
    var maskedValue = value;
    switch (key) {
        case 'cvv':
            maskedValue = '***';
            break;
        case 'emailAddress':
        case 'phoneNumber':
        case 'street':
        case 'zip':
            maskedValue = '**********' + maskedValue.substring(maskedValue.length - 2);
            break;
        default: break;
    }
    return maskedValue;
}

/**
 * Mask certain fields in json object
 * @param {Object} json that will be masked
 * @Returns {string} masked json
 */
function maskJson(json) {
    return JSON.stringify(json, mask);
}

module.exports = {
    mask: mask,
    maskJson: maskJson
};
