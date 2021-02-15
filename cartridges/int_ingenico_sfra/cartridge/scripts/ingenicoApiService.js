/* global request */
var dwsvc = require('dw/svc');
var ingenicoPreferences = require(request.httpHost ? '*/cartridge/scripts/ingenicoPreferences' : './ingenicoPreferences');
var MaskUtil = require(request.httpHost ? '*/cartridge/scripts/util/MaskUtil' : './util/MaskUtil');
var System = require('dw/system/System');

/**
 * Creates a ingenico API service
 * @returns {dw.svc.service} returns a REST service
 */
function createApiService() {
    var serviceName = ingenicoPreferences.getApiService();
    var service = dwsvc.LocalServiceRegistry.createService(serviceName, {
        filterLogMessage: function (msg) {
            try {
                if (System.getInstanceType() === System.PRODUCTION_SYSTEM) {
                    var msgObject = JSON.parse(msg);
                    msg = MaskUtil.maskJson(msgObject);
                }
            } catch (error) {
                // ignore error
            }
            return msg;
        },
        createRequest: function (svc, args) {
            if (args) {
                return args;
            }
            return null;
        },
        parseResponse: function (svc, response) {
            return {
                statusCode: response.statusCode,
                statusMessage: response.statusMessage,
                headers: response.responseHeaders,
                body: JSON.parse(response.text),
                originalResponse: response
            };
        }
    });
    return service;
}

module.exports = {
    create: createApiService
};
