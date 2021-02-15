'use strict';

/**
 * Custom error type.
 * @param {string} message Error message
 */
function InvalidSecretError(message) {
    this.name = 'InvalidSecretError';
    this.message = (message || '');
}

InvalidSecretError.prototype = Object.create(Error.prototype);

module.exports = InvalidSecretError;
