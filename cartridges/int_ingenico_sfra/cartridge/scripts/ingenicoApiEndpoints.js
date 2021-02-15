'use strict';

var apiEndpoints = {
    CREATE_PAYMENT: {
        method: 'POST',
        uri: '/v1/{merchantId}/payments'
    },
    CREATE_HOSTED_CHECKOUT: {
        method: 'POST',
        uri: '/v1/{merchantId}/hostedcheckouts'
    },
    GET_HOSTED_CHECKOUT: {
        method: 'GET',
        uri: '/v1/{merchantId}/hostedcheckouts/{hostedCheckoutId}'
    },
    GET_PAYMENT_STATUS: {
        method: 'GET',
        uri: '/v1/{merchantId}/payments/{paymentId}'
    },
    APPROVE_PAYMENT: {
        method: 'POST',
        uri: '/v1/{merchantId}/payments/{paymentId}/approve'
    },
    CANCEL_PAYMENT: {
        method: 'POST',
        uri: '/v1/{merchantId}/payments/{paymentId}/cancel'
    },
    GET_REFUND: {
        method: 'GET',
        uri: '/v1/{merchantId}/refunds/{refundId}'
    },
    CREATE_REFUND: {
        method: 'POST',
        uri: '/v1/{merchantId}/payments/{paymentId}/refund'
    },
    APPROVE_REFUND: {
        method: 'POST',
        uri: '/v1/{merchantId}/payments/{refundId}/approve'
    },
    CANCEL_REFUND: {
        method: 'POST',
        uri: '/v1/{merchantId}/refunds/{refundId}/cancel'
    },
    FIND_REFUNDS: {
        method: 'GET',
        uri: '/v1/{merchantId}/refunds'
    },
    CREATE_TOKEN: {
        method: 'POST',
        uri: '/v1/{merchantId}/tokens'
    },
    UPDATE_TOKEN: {
        method: 'PUT',
        uri: '/v1/{merchantId}/tokens/{tokenId}'
    },
    GET_TOKEN: {
        method: 'GET',
        uri: '/v1/{merchantId}/tokens/{tokenId}'
    },
    DELETE_TOKEN: {
        method: 'DELETE',
        uri: '/v1/{merchantId}/tokens/{tokenId}'
    },
    GET_IIN_DETAILS: {
        method: 'POST',
        uri: '/v1/{merchantId}/services/getIINdetails'
    },
    GET_PAYMENT_PRODUCT: {
        method: 'GET',
        uri: '/v1/{merchantId}/products/{paymentProductId}'
    },
    CREATE_CLIENT_SESSION: {
        method: 'POST',
        uri: '/v1/{merchantId}/sessions'
    }
};


module.exports = {
    apiEndpoints: apiEndpoints
};
