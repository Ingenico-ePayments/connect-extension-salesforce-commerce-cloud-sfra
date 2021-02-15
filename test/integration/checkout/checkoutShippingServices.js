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
    }
};

describe('checkoutShippingServices', function () {
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
            });
    }

    describe('Submit shipping', function () {
        it('updates shipping address', function () {
            return doRequest().then(function (csrfResponse) {
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
            }).then(function (response) {
                // var bodyAsJson = JSON.parse(response.body);
                // console.log('***********' + response.body + '**********'); // eslint-disable-line
                assert.equal(response.statusCode, 200, 'Expected CheckoutShippingServices-SubmitShipping statusCode to be 200.');
            });
        });
    });

    describe('Update shipping method list', function () {
        it('updates shipping address', function () {
            return doRequest().then(function () {
                myRequest.method = 'POST';
                myRequest.url = config.baseUrl + '/CheckoutShippingServices-UpdateShippingMethodsList';
                myRequest.form = {
                    firstName: testData.shippingAddress.firstName,
                    lastName: testData.shippingAddress.lastName,
                    address1: testData.shippingAddress.address1,
                    address2: testData.shippingAddress.address2,
                    houseNumber: testData.shippingAddress.houseNumber,
                    houseNumberSuffix: testData.shippingAddress.houseNumberSuffix,
                    country: testData.shippingAddress.country,
                    states_stateCode: testData.shippingAddress.stateCode,
                    city: testData.shippingAddress.city,
                    postalCode: testData.shippingAddress.postalCode,
                    phone: testData.shippingAddress.phone
                };
                return request(myRequest);
            }).then(function (response) {
                // var bodyAsJson = JSON.parse(response.body);
                // console.log('***********' + response.body + '**********'); // eslint-disable-line
                assert.equal(response.statusCode, 200, 'Expected CheckoutShippingServices-SubmitShipping statusCode to be 200.');
            });
        });
    });
});
