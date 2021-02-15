'use strict';

var assert = require('chai').assert;
var proxyquire = require('proxyquire').noCallThru().noPreserveCache();

var MaskUtil = proxyquire('../../../../../cartridges/int_ingenico_sfra/cartridge/scripts/util/MaskUtil', {});

describe('ingenicoHelpers', function () {
    var json = {
        customer: {
            emailAddress: 'test@isaac.nl',
            phoneNumber: '012345678',
            title: 'test',
            address: {
                street: 'Test 1234',
                zip: '123456'
            }
        }
    };
    var fields = [
        ['emailAddress', 'test@isaac.nl', '**********nl'],
        ['emailAddress', '2@3.4', '**********.4'],
        ['phoneNumber', '06123456789', '**********89'],
        ['street', 'Marconilaan', '**********an'],
        ['street', 'Marconilaan 16A', '**********6A'],
        ['zip', '5621AX', '**********AX'],
        ['city', 'Eindhoven', 'Eindhoven'],
        ['zipCode', '5621AX', '5621AX']
    ];
    fields.forEach(function (field, index) {
        it('should have masked field correctly ' + index, function () {
            var field = fields[index];
            var result = MaskUtil.mask(field[0], field[1]);
            var expectedResult = field[2];
            assert.equal(result, expectedResult);
        });
    });
    it('should have masked fields in JSON correctly ', function () {
        var result = MaskUtil.maskJson(json);
        var expectedResult = '{"customer":{"emailAddress":"**********nl","phoneNumber":"**********78","title":"test","address":{"street":"**********34","zip":"**********56"}}}';
        assert.equal(result, expectedResult);
    });
});

