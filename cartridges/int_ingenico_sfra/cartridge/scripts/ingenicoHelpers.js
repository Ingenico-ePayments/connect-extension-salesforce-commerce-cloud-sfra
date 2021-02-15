/* global dw, request */
'use strict';

var Logger = require('dw/system/Logger');
var ingenicoLogger = Logger.getLogger('Ingenico');
var createApiService = require(request.httpHost ? '*/cartridge/scripts/ingenicoApiService' : './ingenicoApiService').create;
var MaskUtil = require(request.httpHost ? '*/cartridge/scripts/util/MaskUtil' : './util/MaskUtil');
var Encoding = require('dw/crypto/Encoding');
var apiEndpoints = require('./ingenicoApiEndpoints').apiEndpoints;

/**
 * Replace the placeholder with the path variables
 * @param {string} uri the uri that contains some placeholders
 * @param {Object} variables values that replaces the placeholders
 * @returns {string} the uri with replaced values
 */
function replacePathVariables(uri, variables) {
    Object.keys(variables).forEach(function (variable) {
        uri = uri.replace('{' + variable + '}', variables[variable]);
    });
    return uri;
}

/**
 * Add the query parameters to the uri
 * @param {string} uri the uri of the request
 * @param {Object} parameters of the uri
 * @returns {string} the uri with the parameters appended
 */
function addQueryParameters(uri, parameters) {
    var queryString = '';
    Object.keys(parameters).forEach(function (key, index) {
        if (index === 0) {
            queryString += '?' + key + '=' + parameters[key];
        } else {
            queryString += '&' + key + '=' + parameters[key];
        }
    });
    return uri + queryString;
}

/**
 * Get the headers as a sorted string.
 * @param {Object} gcsHeaders headers
 * @returns {string} header string
 */
function getSortedHeadersForContext(gcsHeaders) {
    var headers = '';
    if (gcsHeaders) {
        var sortedXGCSHeaders = [];
        Object.keys(gcsHeaders).forEach(function (header) {
            if (header.toUpperCase().indexOf('X-GCS') === 0) {
                // add this header
                sortedXGCSHeaders.push(header);
            }
        });

        sortedXGCSHeaders = sortedXGCSHeaders.sort();

        sortedXGCSHeaders.forEach(function (header) {
            headers += header.toLowerCase() + ':' + gcsHeaders[header] + '\n';
        });
    }
    return headers;
}

/**
 * Create a signature that is required for communicating with the Ingenico API/
 * @param {Object} service the api service
 * @param {string} method of the HTTP request
 * @param {string} uri of the HTTP request
 * @param {Array} gcsHeaders of the HTTP request
 * @returns {string} signature
 */
function createIngenicoSignature(service, method, uri, gcsHeaders) {
    var Mac = require('dw/crypto/Mac');
    var apiClientId = service.getConfiguration().getCredential().custom.ingenicoApiClientId;
    var apiClientSecret = service.getConfiguration().getCredential().custom.ingenicoApiClientSecret;
    var currentDate = new Date().toUTCString();
    var contentType = 'application/json';
    var headers = getSortedHeadersForContext(gcsHeaders);

    var signedData = method + '\n' + contentType + '\n' + currentDate + '\n' + headers + uri + '\n';

    var encryptor = new Mac(Mac.HMAC_SHA_256);
    var signatureBytes = encryptor.digest(signedData, apiClientSecret);
    var signature = Encoding.toBase64(signatureBytes);
    return 'GCS v1HMAC:' + apiClientId + ':' + signature;
}

/**
 * Add some generic headers to the API service
 * @param {Object} service the api service
 * @param {string} method of the HTTP request
 * @param {string} uri the uri of the HTTP endpoint
 * @param {Array} gcsHeaders of the HTTP request
 */
function addGenericHeaders(service, method, uri, gcsHeaders) {
    service.addHeader('Authorization', createIngenicoSignature(service, method, uri, gcsHeaders));
    service.addHeader('Date', new Date().toUTCString());
    service.addHeader('Path', uri);
    service.addHeader('Content-type', 'application/json');
    service.addHeader('charset', 'UTF-8');
}

/**
 * Create a service with the service URL, body string and parameters set.
 * @param {dw.svc.service} service Service object to make the actual http calls
 * @param {Object} ingenicoEndpoint of the Ingenico API
 * @param {Object} pathVariables of the Ingenico API endpoint
 * @param {string} body JSON body to send to Ingenico API
 * @param {Array} parameters to send to Ingenico API
 * @returns {Object} returns a service
 */
function getGenericIngenicoService(service, ingenicoEndpoint, pathVariables, body, parameters) {
    var bytes = require('dw/util/Bytes');
    var Resource = require('dw/web/Resource');
    var System = require('dw/system/System');

    var uri = replacePathVariables(ingenicoEndpoint.uri, pathVariables);
    if (parameters !== undefined) {
        uri = addQueryParameters(uri, parameters);
    }
    var method = ingenicoEndpoint.method;
    service.URL += uri;
    service.setRequestMethod(method);

    var serverMetaInfo = {
        shoppingCartExtension: {
            creator: Resource.msg('shoppingCartExtension.creator', 'version', null),
            version: Resource.msg('global.version.number', 'version', null),
            name: Resource.msg('shoppingCartExtension.name', 'version', null),
            extensionId: Resource.msg('shoppingCartExtension.extensionId', 'version', null)
        }
    };
    var encodedServerMetaInfo = Encoding.toBase64(bytes(JSON.stringify(serverMetaInfo)));
    var gcsHeaders = {
        'X-GCS-ServerMetaInfo': encodedServerMetaInfo
    };
    Object.keys(gcsHeaders).forEach(function (header) {
        service.addHeader(header, gcsHeaders[header]);
    });

    addGenericHeaders(service, method, uri, gcsHeaders);
    // obfuscate sensitive data if PROD environment
    var bodyString = System.getInstanceType() === System.PRODUCTION_SYSTEM ? MaskUtil.maskJson(body) : JSON.stringify(body);

    if (['POST', 'PUT', 'PATCH'].indexOf(method) >= 0) {
        ingenicoLogger.info('Request {0} {1}\nRequest Body: {2}', method, service.URL, bodyString);
    } else {
        ingenicoLogger.info('Request {0} {1}\nParams: {2}', method, service.URL, JSON.stringify(parameters));
    }
    return service;
}

/**
 * Determine the service URL given the provided environment.
 * @param {string} environment the chosen environement
 * @returns {string} the service URL
 */
function getApiServiceUrl(environment) {
    var prefix = '';
    switch (environment) {
        case 'SANDBOX':
            prefix = 'eu.sandbox';
            break;
        case 'PREPROD':
            prefix = 'world.preprod';
            break;
        case 'PROD':
            prefix = 'world';
            break;
        default: ingenicoLogger.error('Unknown environment {0}.', environment); break;

    }
    return 'https://' + prefix + '.api-ingenico.com';
}

/**
 * Set the baseUrl for the API service
 * @param {Object} service the api service
 */
function setBaseUrlForService(service) {
    var apiEnvironment = service.getConfiguration().getCredential().custom.ingenicoApiEnvironment;
    var apiBaseUrl = getApiServiceUrl(apiEnvironment.getValue());
    service.setURL(apiBaseUrl);
}

/**
 * Handle the response that is returned from the Ingenico API
 * @param {Object} result of the Ingenico API call
 * @param {string} method of the HTTP request
 * @param {Object} service the
 * @returns {Object} response
 */
function handleResponse(result, method, service) {
    if (result.isOk()) {
        ingenicoLogger.debug('Response from {0} {1}\nStatus: {2}\nResponse: {3}', method, service.URL, result.status, JSON.stringify(result.object));
    } else {
        ingenicoLogger.error('Error response received. Set Log Level for "Ingenico" Custom Log Filter to "DEBUG" for more details.');
        ingenicoLogger.debug('Response from {0} {1}\nStatus: {2} {3}\nResponse Body: {4}', method, service.URL, result.status, result.msg, result.errorMessage);
    }

    var resultObject = result.object;
    if (resultObject) {
        var bodyText = JSON.stringify(resultObject.body);
        return JSON.parse(bodyText);
    }

    // build the error response object
    var body;
    try {
        body = JSON.parse(result.errorMessage);
    } catch (ex) {
        ingenicoLogger.error('error parsing response object ' + ex.message);
        body = null;
    }
    return body;
}
/**
 * Sends a request to the Ingenico API to create a payment.
 * @param {Object} body JSON body to send to Ingenico API
 * @returns {Object} returns the response of the API
 */
function createPayment(body) {
    var apiService = createApiService();
    var merchantId = apiService.getConfiguration().getCredential().custom.ingenicoMerchantId;
    var pathVariables = { merchantId: merchantId };
    var bodyString = JSON.stringify(body);
    setBaseUrlForService(apiService);
    apiService = getGenericIngenicoService(apiService, apiEndpoints.CREATE_PAYMENT, pathVariables, body);

    var result = apiService.call(bodyString);
    return handleResponse(result, apiEndpoints.CREATE_PAYMENT.method, apiService);
}

/**
 * Sends a request to the Ingenico API to create a hosted checkout.
 * @param {Object} body JSON body to send to Ingenico API
 * @returns {Object} returns the response of the API
 */
function createHostedCheckout(body) {
    var apiService = createApiService();
    var merchantId = apiService.getConfiguration().getCredential().custom.ingenicoMerchantId;
    var pathVariables = { merchantId: merchantId };
    var bodyString = JSON.stringify(body);
    setBaseUrlForService(apiService);
    apiService = getGenericIngenicoService(apiService, apiEndpoints.CREATE_HOSTED_CHECKOUT, pathVariables, body);

    var result = apiService.call(bodyString);
    return handleResponse(result, apiEndpoints.CREATE_HOSTED_CHECKOUT.method, apiService);
}

/**
 * Sends a request to the Ingenico API to get hosted checkout status
 * @param {string} hostedCheckoutId the hosted checkout Id of a transaction
 * @returns {Object} returns the response of the API
 */
function getHostedCheckoutStatus(hostedCheckoutId) {
    var apiService = createApiService();
    var merchantId = apiService.getConfiguration().getCredential().custom.ingenicoMerchantId;
    var pathVariables = { merchantId: merchantId, hostedCheckoutId: hostedCheckoutId };
    setBaseUrlForService(apiService);

    apiService = getGenericIngenicoService(apiService, apiEndpoints.GET_HOSTED_CHECKOUT, pathVariables);
    var result = apiService.call(null);
    return handleResponse(result, apiEndpoints.GET_HOSTED_CHECKOUT.method, apiService);
}

/**
 * Sends a request to the Ingenico API to get payment status
 * @param {string} paymentId the transaction
 * @returns {Object} returns the response of the API
 */
function getPaymentStatus(paymentId) {
    var apiService = createApiService();
    var merchantId = apiService.getConfiguration().getCredential().custom.ingenicoMerchantId;
    var pathVariables = { merchantId: merchantId, paymentId: paymentId };
    setBaseUrlForService(apiService);

    apiService = getGenericIngenicoService(apiService, apiEndpoints.GET_PAYMENT_STATUS, pathVariables);
    var result = apiService.call(null);
    return handleResponse(result, apiEndpoints.GET_PAYMENT_STATUS.method, apiService);
}

/**
 * Sends a request to the Ingenico API to find all refunds related to a transaction
 * @param {string} hostedCheckoutId of a transaction
 * @returns {Object} returns the response of the API
 */
function findRefunds(hostedCheckoutId) {
    var apiService = createApiService();
    var merchantId = apiService.getConfiguration().getCredential().custom.ingenicoMerchantId;
    var pathVariables = { merchantId: merchantId };
    var parameters = { hostedCheckoutId: hostedCheckoutId };
    setBaseUrlForService(apiService);

    apiService = getGenericIngenicoService(apiService, apiEndpoints.FIND_REFUNDS, pathVariables, {}, parameters);
    var result = apiService.call(null);
    return handleResponse(result, apiEndpoints.FIND_REFUNDS.method, apiService);
}

/**
 * Sends a request to the Ingenico API to approve payment with the given paymentId
* @param {dw.order.Order} order Order for which the payment must be approved
 * @param {string} paymentId of the transaction that needs to be approved
 * @param {int} amountInCents to approve in case of partial capture
 * @returns {Object} returns the response of the API
 */
function approvePayment(order, paymentId, amountInCents) {
    var apiService = createApiService();
    var merchantId = apiService.getConfiguration().getCredential().custom.ingenicoMerchantId;
    var body;
    if (!amountInCents) {
        body = {
            amount: amountInCents
        };
    }
    var bodyString = JSON.stringify(body);
    var pathVariables = { merchantId: merchantId, paymentId: paymentId };
    setBaseUrlForService(apiService);

    apiService = getGenericIngenicoService(apiService, apiEndpoints.APPROVE_PAYMENT, pathVariables, body);
    var result = apiService.call(bodyString);
    return handleResponse(result, apiEndpoints.APPROVE_PAYMENT.method, apiService);
}

/**
 * Sends a request to the Ingenico API to get the refund status for the given refundId
 * @param {string} refundId id of the given refund
 * @returns {Object} returns the response of the API
 */
function getRefundStatus(refundId) {
    var apiService = createApiService();
    var merchantId = apiService.getConfiguration().getCredential().custom.ingenicoMerchantId;
    var pathVariables = { merchantId: merchantId, refundId: refundId };
    setBaseUrlForService(apiService);

    apiService = getGenericIngenicoService(apiService, apiEndpoints.GET_REFUND, pathVariables);
    var result = apiService.call(null);
    return handleResponse(result, apiEndpoints.GET_REFUND.method, apiService);
}

/**
 * Sends a request to the Ingenico API to create a refund for the given paymentId
 * @param {dw.order.Order} order Order for which to create a refund
 * @param {string} paymentId of the transaction that needs to be approved
 * @param {int} amountInCents to approve in case of partial refund
 * @returns {Object} returns the response of the API
 */
function createRefund(order, paymentId, amountInCents) {
    var apiService = createApiService();
    var merchantId = apiService.getConfiguration().getCredential().custom.ingenicoMerchantId;
    var body = {
        amountOfMoney: {
            amount: amountInCents,
            currencyCode: order.getCurrencyCode()
        },
        refundReferences: {
            merchantReference: order.orderNo + '_' + new Date().valueOf()
        }
    };
    var bodyString = JSON.stringify(body);
    var pathVariables = { merchantId: merchantId, paymentId: paymentId };
    setBaseUrlForService(apiService);

    apiService = getGenericIngenicoService(apiService, apiEndpoints.CREATE_REFUND, pathVariables, body);
    var result = apiService.call(bodyString);
    return handleResponse(result, apiEndpoints.CREATE_REFUND.method, apiService);
}
/**
 * Sends a request to the Ingenico API to approve a refund for the given refundId
 * @param {string} refundId id of the given refund
 * @param {int} amountInCents to approve if you want to change refund amount
 * @returns {Object} returns the response of the API
 */
function approveRefund(refundId, amountInCents) {
    var apiService = createApiService();
    var merchantId = apiService.getConfiguration().getCredential().custom.ingenicoMerchantId;
    var pathVariables = { merchantId: merchantId, refundId: refundId };
    var body;
    var bodyString = null;
    if (amountInCents) {
        body = {
            amount: amountInCents
        };
        bodyString = JSON.stringify(body);
    }
    setBaseUrlForService(apiService);

    apiService = getGenericIngenicoService(apiService, apiEndpoints.APPROVE_REFUND, pathVariables, body);
    var result = apiService.call(bodyString);
    return handleResponse(result, apiEndpoints.APPROVE_REFUND.method, apiService);
}

/**
 * Sends a request to the Ingenico API to cancel a refund for the given refundId
 * @param {string} refundId id of the given refund
 * @returns {Object} returns the response of the API
 */
function cancelRefund(refundId) {
    var apiService = createApiService();
    var merchantId = apiService.getConfiguration().getCredential().custom.ingenicoMerchantId;
    var pathVariables = { merchantId: merchantId, refundId: refundId };
    setBaseUrlForService(apiService);

    apiService = getGenericIngenicoService(apiService, apiEndpoints.CANCEL_REFUND, pathVariables);
    var result = apiService.call(null);
    return handleResponse(result, apiEndpoints.CANCEL_REFUND.method, apiService);
}

/**
 * Sends a request to the Ingenico API to cancel a payment
 * @param {string} paymentId of the transaction to cancel
 * @returns {Object} returns the response of the API
 */
function cancelPayment(paymentId) {
    var apiService = createApiService();
    var merchantId = apiService.getConfiguration().getCredential().custom.ingenicoMerchantId;
    var pathVariables = { merchantId: merchantId, paymentId: paymentId };
    setBaseUrlForService(apiService);

    apiService = getGenericIngenicoService(apiService, apiEndpoints.CANCEL_PAYMENT, pathVariables);
    var result = apiService.call(null);
    return handleResponse(result, apiEndpoints.CANCEL_PAYMENT.method, apiService);
}

/**
 * Sends a request to the Ingenico API to create a token with the provided card details
 * @param {Object} body of the create token request
 * @returns {Object} returns the response of the API
 */
function createToken(body) {
    var apiService = createApiService();
    var merchantId = apiService.getConfiguration().getCredential().custom.ingenicoMerchantId;
    var bodyString = JSON.stringify(body);
    var pathVariables = { merchantId: merchantId };
    setBaseUrlForService(apiService);

    apiService = getGenericIngenicoService(apiService, apiEndpoints.CREATE_TOKEN, pathVariables, body);
    var result = apiService.call(bodyString);
    return handleResponse(result, apiEndpoints.CREATE_TOKEN.method, apiService);
}

/**
 * Sends a request to the Ingenico API to delete a token
 * @param {string} tokenId id of the token
 * @returns {Object} returns the response of the API
 */
function deleteToken(tokenId) {
    var apiService = createApiService();
    var merchantId = apiService.getConfiguration().getCredential().custom.ingenicoMerchantId;
    var pathVariables = { merchantId: merchantId, tokenId: tokenId };
    setBaseUrlForService(apiService);

    apiService = getGenericIngenicoService(apiService, apiEndpoints.DELETE_TOKEN, pathVariables);
    var result = apiService.call(null);
    return handleResponse(result, apiEndpoints.DELETE_TOKEN.method, apiService);
}

/**
 * Sends a request to the Ingenico API to get a token
 * @param {string} tokenId id of the token
 * @returns {Object} returns the response of the API
 */
function getToken(tokenId) {
    var apiService = createApiService();
    var merchantId = apiService.getConfiguration().getCredential().custom.ingenicoMerchantId;
    var pathVariables = { merchantId: merchantId, tokenId: tokenId };
    setBaseUrlForService(apiService);

    apiService = getGenericIngenicoService(apiService, apiEndpoints.GET_TOKEN, pathVariables);
    var result = apiService.call(null);
    return handleResponse(result, apiEndpoints.GET_TOKEN.method, apiService);
}

/**
 * Sends a request to the Ingenico API to get IIN details
 * @param {Object} cardNumber of the customer
 * @returns {Object} returns the response of the API
 */
function getIINdetails(cardNumber) {
    var apiService = createApiService();
    var merchantId = apiService.getConfiguration().getCredential().custom.ingenicoMerchantId;
    var pathVariables = { merchantId: merchantId };
    var body = {
        bin: cardNumber
    };
    var bodyString = JSON.stringify(body);
    setBaseUrlForService(apiService);

    apiService = getGenericIngenicoService(apiService, apiEndpoints.GET_IIN_DETAILS, pathVariables, body);
    var result = apiService.call(bodyString);
    return handleResponse(result, apiEndpoints.GET_IIN_DETAILS.method, apiService);
}

/**
 * Sends a request to the Ingenico API to find all required fields related to a payment product
 * @param {string} countryCode of the order
 * @param {string} currencyCode of the order
 * @param {string} paymentProductId of a transaction
 * @returns {Object} returns the response of the API
 */
function getPaymentProduct(countryCode, currencyCode, paymentProductId) {
    var apiService = createApiService();
    var merchantId = apiService.getConfiguration().getCredential().custom.ingenicoMerchantId;
    var pathVariables = { merchantId: merchantId, paymentProductId: paymentProductId };
    var parameters = {
        countryCode: countryCode,
        currencyCode: currencyCode
    };
    setBaseUrlForService(apiService);

    apiService = getGenericIngenicoService(apiService, apiEndpoints.GET_PAYMENT_PRODUCT, pathVariables, {}, parameters);
    var result = apiService.call(null);
    return handleResponse(result, apiEndpoints.GET_PAYMENT_PRODUCT.method, apiService);
}

/**
 * Sends a request to the Ingenico API to create a client session
 * @returns {Object} returns the response of the API
 */
function createClientSession() {
    var apiService = createApiService();
    var merchantId = apiService.getConfiguration().getCredential().custom.ingenicoMerchantId;
    var pathVariables = { merchantId: merchantId };
    var body = {
        tokens: []
    };
    var bodyString = JSON.stringify(body);
    setBaseUrlForService(apiService);

    apiService = getGenericIngenicoService(apiService, apiEndpoints.CREATE_CLIENT_SESSION, pathVariables);
    var result = apiService.call(bodyString);
    return handleResponse(result, apiEndpoints.CREATE_CLIENT_SESSION.method, apiService);
}


/**
 * Gets the Webhooks secret configured on the service credentials.
 * @return {string} Webhooks secret
 */
function getIngenicoWebhooksSecret() {
    var apiService = createApiService();
    return apiService.getConfiguration().getCredential().custom.ingenicoWebhooksSecret;
}

/**
 * Get a list of iDeal issuers that are supported
 * @return {Object} a list of issuers
 */
function getIdealIssuers() {
    var response = getPaymentProduct('NL', 'EUR', 809); // iDeal is only applicable for NL and EURO

    var issuers = [];
    var placeHolder = 'No issuers available';

    if (!response.errors) {
        var issuerIds = response.fields.filter(function (field) {
            return field.id === 'issuerId';
        })[0];
        issuers = issuerIds.displayHints.formElement.valueMapping.map(function (mapping) {
            return {
                id: mapping.value,
                displayName: mapping.displayName
            };
        });
        placeHolder = issuerIds.displayHints.placeholderLabel;
    }

    return {
        placeholderLabel: placeHolder,
        issuers: issuers
    };
}

module.exports = {
    createPayment: createPayment,
    createHostedCheckout: createHostedCheckout,
    getHostedCheckoutStatus: getHostedCheckoutStatus,
    getPaymentStatus: getPaymentStatus,
    approvePayment: approvePayment,
    cancelPayment: cancelPayment,
    getRefundStatus: getRefundStatus,
    createRefund: createRefund,
    findRefunds: findRefunds,
    approveRefund: approveRefund,
    cancelRefund: cancelRefund,
    createToken: createToken,
    getToken: getToken,
    deleteToken: deleteToken,
    getIINdetails: getIINdetails,
    getPaymentProduct: getPaymentProduct,
    createClientSession: createClientSession,
    getIngenicoWebhooksSecret: getIngenicoWebhooksSecret,
    getIdealIssuers: getIdealIssuers
};
