'use strict';

/**
 * Custom error type.
 * @param {string} message Error message
 */
function InvalidEventTypeError(message) {
    this.name = 'InvalidEventTypeError';
    this.message = (message || '');
}

InvalidEventTypeError.prototype = Object.create(Error.prototype);

module.exports = InvalidEventTypeError;
