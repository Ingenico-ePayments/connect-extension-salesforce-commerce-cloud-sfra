var assert = require('chai').assert;
var request = require('request-promise');
var config = require('../it.config');

function getNotifications(orderNo) {
    return request({
        url: config.baseUrl + '/Test-Notifications',
        method: 'GET',
        rejectUnauthorized: false,
        resolveWithFullResponse: true,
        headers: {
            'X-Requested-With': 'XMLHttpRequest'
        },
        qs: {
            orderNo: orderNo
        },
        json: true
    });
}

describe('Ingenico', function () {
    this.timeout(25000);
    beforeEach(function () {
        return request({
            url: config.baseUrl + '/Test-Build',
            method: 'POST',
            rejectUnauthorized: false,
            resolveWithFullResponse: true,
            headers: {
                'X-Requested-With': 'XMLHttpRequest'
            },
            json: true,
            body: {
                clear: true
            }
        });
    });

    function getVerificationRequest() {
        var verificationString = 'ThisIsATest';

        var myRequest = {
            url: '',
            method: 'GET',
            rejectUnauthorized: false,
            resolveWithFullResponse: true,
            headers: {
                'X-Requested-With': 'XMLHttpRequest',
                'X-GCS-Webhooks-Endpoint-Verification': verificationString
            }
        };

        myRequest.url = config.baseUrl + '/Ingenico-Notify';
        myRequest.json = true;
        return myRequest;
    }

    function getWebhookRequest() {
        var signature = 'gHAFPXzaWPw87Q1KVnDIK5jHO5dHIC5zOoj+tAO/aRI=';
        var testData = {
            'apiVersion': 'v1',
            'created': '2020-08-14T15:20:09.544+0200',
            'id': '31f9bb07-15fa-45ae-9b57-251c44ee12d1A',
            'merchantId': '10956',
            'payment': {
                'id': '000001095610000010010000100001',
                'hostedCheckoutSpecificOutput': {
                    'hostedCheckoutId': '1a7d8556-b139-43a8-9ee9-3b97fae1eab9',
                    'variant': '102'
                },
                'paymentOutput': {
                    'amountOfMoney': {
                        'amount': 3778,
                        'currencyCode': 'USD'
                    },
                    'references': {
                        'merchantReference': '00019717_1597411164171',
                        'paymentReference': '0'
                    },
                    'paymentMethod': 'card',
                    'cardPaymentMethodSpecificOutput': {
                        'paymentProductId': 1,
                        'authorisationCode': '654321',
                        'fraudResults': {
                            'fraudServiceResult': 'accepted',
                            'avsResult': '0',
                            'cvvResult': '0',
                            'retailDecisions': {
                                'fraudCode': '0150',
                                'fraudNeural': '30',
                                'fraudRCF': 'CNBAACC'
                            }
                        },
                        'threeDSecureResults': {
                            'cavv': 'AAABBEg0VhI0VniQEjRWAAAAAAA=',
                            'eci': '5',
                            'xid': '31353937343131313938'
                        },
                        'card': {
                            'cardNumber': '************0002',
                            'expiryDate': '1222'
                        }
                    }
                },
                'status': 'PENDING_APPROVAL',
                'statusOutput': {
                    'isCancellable': true,
                    'statusCategory': 'PENDING_MERCHANT',
                    'statusCode': 600,
                    'statusCodeChangeDateTime': '20200814151959',
                    'isAuthorized': true,
                    'isRefundable': false
                }
            },
            'type': 'payment.pending_approval'
        };

        var myRequest = {
            url: '',
            method: 'POST',
            rejectUnauthorized: false,
            resolveWithFullResponse: true,
            headers: {
                'X-Requested-With': 'XMLHttpRequest',
                'X-GCS-Signature': signature
            }
        };

        myRequest.url = config.baseUrl + '/Ingenico-Notify';
        myRequest.json = true;
        myRequest.body = testData;
        return myRequest;
    }

    describe('Notify', function () {
        it('accepts a correct verification request', function () {
            var originalRequest = getVerificationRequest();
            return request(originalRequest).then(function (response) {
                var bodyAsJson = response.body;
                assert.equal(response.statusCode, 200, 'Expected Notify request statusCode to be 200.');
                assert.equal(bodyAsJson.trim(), 'ThisIsATest');
            });
        });
    });
    describe('Notify', function () {
        it('accepts a correct webhook request', function () {
            var originalRequest = getWebhookRequest();
            return request(originalRequest).then(function (response) {
                // var bodyAsJson = response.body;
                assert.equal(response.statusCode, 200, 'Expected Notify request statusCode to be 200.');
                return getNotifications(originalRequest.body.payment.paymentOutput.references.merchantReference.split('_')[0]);
            })
            .then(function (response) {
                assert.equal(response.body.notifications.length, 1, 'Expected notification count to be exactly 1.');
            });
        });
        it('accepts a double request but does not persist the data', function () {
            var originalRequest = getWebhookRequest();
            return request(originalRequest).then(function () {
                return request(getWebhookRequest());
            })
            .then(function (response) {
                assert.equal(response.statusCode, 200, 'Expected a second Notify request statusCode to be 200.');
                assert.equal(response.body.success, true, 'Expected a second Notify to return a success boolean.');
                return getNotifications(originalRequest.body.payment.paymentOutput.references.merchantReference.split('_')[0]);
            })
            .then(function (response) {
                assert.equal(response.body.notifications.length, 1, 'Expected notification count to be exactly 1.');
            });
        });
    });
});
