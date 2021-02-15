var assert = require('chai').assert;
var request = require('request-promise');
var config = require('../it.config');

var testData = {
    variantId: '701644333805M',
    shippingAddress: {
        firstName: 'Jane',
        lastName: 'Smith',
        address1: '10 main Street',
        address2: '',
        houseNumber: 1,
        houseNumberSuffix: 'a',
        country: 'NL',
        stateCode: 'NY',
        city: 'burlington',
        postalCode: '14304',
        phone: '3333333333'
    },
    billingAddress: {
        firstName: 'Jane',
        lastName: 'Smith',
        address1: '10 main Street',
        address2: '',
        houseNumber: 1,
        houseNumberSuffix: 'a',
        country: 'NL',
        stateCode: 'NY',
        city: 'burlington',
        postalCode: '14304',
        phone: '3333333333'
    }
};

describe('checkoutServices', function () {
    this.timeout(25000);

    var variantId = testData.variantId;
    var quantity = 1;
    var cookieJar = request.jar();
    var cookieString;

    var myRequest = {
        url: '',
        method: 'POST',
        rejectUnauthorized: false,
        resolveWithFullResponse: true,
        jar: cookieJar,
        headers: {
            'X-Requested-With': 'XMLHttpRequest'
        }
    };

    myRequest.url = config.baseUrl + '/Cart-AddProduct';
    myRequest.form = {
        pid: variantId,
        quantity: quantity
    };

    function doRequest() {
        // ----- adding product to Cart
        return request(myRequest)
            .then(function (response) {
                assert.equal(response.statusCode, 200, 'Expected add to Cart request statusCode to be 200.');
                cookieString = cookieJar.getCookieString(myRequest.url);
            })
            // --- csrf token generation
            .then(function () {
                myRequest.method = 'POST';
                myRequest.url = config.baseUrl + '/CSRF-Generate';
                var cookie = request.cookie(cookieString);
                cookieJar.setCookie(cookie, myRequest.url);
                return request(myRequest);
            })
            // set shipping address
            .then(function (csrfResponse) {
                var csrfJsonResponse = JSON.parse(csrfResponse.body);
                myRequest.method = 'POST';
                myRequest.url = config.baseUrl + '/CheckoutShippingServices-SubmitShipping?' +
                    csrfJsonResponse.csrf.tokenName + '=' +
                    csrfJsonResponse.csrf.token;
                myRequest.form = {
                    dwfrm_shipping_shippingAddress_addressFields_firstName: testData.shippingAddress.firstName,
                    dwfrm_shipping_shippingAddress_addressFields_lastName: testData.shippingAddress.lastName,
                    dwfrm_shipping_shippingAddress_addressFields_address1: testData.shippingAddress.address1,
                    dwfrm_shipping_shippingAddress_addressFields_address2: testData.shippingAddress.address2,
                    dwfrm_shipping_shippingAddress_addressFields_houseNumber: testData.shippingAddress.houseNumber,
                    dwfrm_shipping_shippingAddress_addressFields_houseNumberSuffix: testData.shippingAddress.houseNumberSuffix,
                    dwfrm_shipping_shippingAddress_addressFields_country: testData.shippingAddress.country,
                    dwfrm_shipping_shippingAddress_addressFields_states_stateCode: testData.shippingAddress.stateCode,
                    dwfrm_shipping_shippingAddress_addressFields_city: testData.shippingAddress.city,
                    dwfrm_shipping_shippingAddress_addressFields_postalCode: testData.shippingAddress.postalCode,
                    dwfrm_shipping_shippingAddress_addressFields_phone: testData.shippingAddress.phone,
                    dwfrm_shipping_shippingAddress_shippingMethodID: '001'
                };
                return request(myRequest);
            })
            // response of submitshipping
            .then(function (response) {
                assert.equal(response.statusCode, 200, 'Expected CheckoutShippingServices-SubmitShipping statusCode to be 200.');
            })
            // csrf token generation
            .then(function () {
                myRequest.method = 'POST';
                myRequest.url = config.baseUrl + '/CSRF-Generate';
                var cookie = request.cookie(cookieString);
                cookieJar.setCookie(cookie, myRequest.url);
                return request(myRequest);
            })
            // setting billing address and payment method
            .then(function (csrfResponse) {
                var csrfJsonResponse = JSON.parse(csrfResponse.body);
                myRequest.method = 'POST';
                myRequest.url = config.baseUrl + '/CheckoutServices-SubmitPayment?' +
                    csrfJsonResponse.csrf.tokenName + '=' +
                    csrfJsonResponse.csrf.token;
                myRequest.form = {
                    dwfrm_billing_addressFields_firstName: testData.billingAddress.firstName,
                    dwfrm_billing_addressFields_lastName: testData.billingAddress.lastName,
                    dwfrm_billing_addressFields_address1: testData.billingAddress.address1,
                    dwfrm_billing_addressFields_address2: testData.billingAddress.address2,
                    dwfrm_billing_addressFields_houseNumber: testData.billingAddress.houseNumber,
                    dwfrm_billing_addressFields_houseNumberSuffix: testData.billingAddress.houseNumberSuffix,
                    dwfrm_billing_addressFields_country: testData.billingAddress.country,
                    dwfrm_billing_addressFields_states_stateCode: testData.billingAddress.stateCode,
                    dwfrm_billing_addressFields_city: testData.billingAddress.city,
                    dwfrm_billing_addressFields_postalCode: testData.billingAddress.postalCode,
                    dwfrm_billing_billingUserFields_email: testData.billingAddress.email,
                    dwfrm_billing_billingUserFields_phone: testData.billingAddress.phone,
                    dwfrm_billing_creditCardFields_cpf: '',
                    dwfrm_billing_paymentMethod: 'HOSTED_CREDIT_CARD'
                };
                return request(myRequest);
            });
    }

    describe('Submit payment', function () {
        it('prepares an Ingenico payment', function () {
            return doRequest().then(function (response) {
                // var bodyAsJson = JSON.parse(response.body);
                // console.log('***********' + JSON.stringify(bodyAsJson) + '**********'); // eslint-disable-line
                assert.equal(response.statusCode, 200, 'Expected CheckoutServices-SubmitPayment statusCode to be 200.');
            });
        });
    });

    describe('Place order', function () {
        it('creates an Ingenico payment', function () {
            return doRequest().then(function () {
                myRequest.url = config.baseUrl + '/CheckoutServices-PlaceOrder';
                return request(myRequest)
                // Handle response from request
                .then(function (response) {
                    var bodyAsJson = JSON.parse(response.body);
                    console.log('***********' + JSON.stringify(bodyAsJson) + '**********'); // eslint-disable-line
                    assert.equal(response.statusCode, 200, 'Expected statusCode to be 200.');
                    assert.equal(bodyAsJson.error, false, 'Expected error status is false.');
                    assert.equal((bodyAsJson.continueUrl).includes('ingenico'), true, 'Expected payment method should be in url.');
                });
            });
        });
    });
});
