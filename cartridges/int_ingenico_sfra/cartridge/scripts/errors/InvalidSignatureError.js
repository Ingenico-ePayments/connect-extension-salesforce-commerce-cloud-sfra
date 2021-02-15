'use strict';

/**
 * Custom error type.
 * @param {string} message Error message
 */
function InvalidSignatureError(message) {
    this.name = 'InvalidSignatureError';
    this.message = (message || '');
}

InvalidSignatureError.prototype = Object.create(Error.prototype);

module.exports = InvalidSignatureError;
