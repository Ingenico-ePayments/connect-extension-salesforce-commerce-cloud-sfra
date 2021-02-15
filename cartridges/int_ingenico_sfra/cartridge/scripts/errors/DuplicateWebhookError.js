'use strict';

/**
 * Custom error type.
 * @param {string} message Error message
 */
function DuplicateWebhookError(message) {
    this.name = 'DuplicateWebhookError';
    this.message = (message || '');
}

DuplicateWebhookError.prototype = Object.create(Error.prototype);

module.exports = DuplicateWebhookError;
