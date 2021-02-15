'use strict';

var assert = require('chai').assert;
var proxyquire = require('proxyquire').noCallThru().noPreserveCache();
var ingenicoPayloadHelpers = proxyquire('../../../../cartridges/int_ingenico_sfra/cartridge/scripts/ingenicoPayloadHelpers', {
    'dw/web/URLUtils': {
    },
    'dw/web/Resource': {
        msg: function (key) {
            return key;
        }
    }
});

describe('ingenicoPayloadHelpers', function () {
    var addresses = [
        [
            ['NON_MATCHING_ADDRESS', '', ''],
            ['NON_MATCHING_ADDRESS', '', '']
        ],
        [
            ['street', '2', 'additional info'],
            ['street', '2', 'additional info']
        ],
        [
            ['Janssenboulevard', '6', 'r'],
            ['Janssenboulevard', '6', 'r']
        ],
        [
            ['Janssenboulevard', '6r', ''],
            ['Janssenboulevard', '6', 'r']
        ],
        [
            ['Janssenboulevard 6r', '', ''],
            ['Janssenboulevard', '6', 'r']
        ],
        [
            ['Janssen Boulevard 6r', '', ''],
            ['Janssen Boulevard', '6', 'r']
        ],
        [
            ['   Janssen Boulevard    6    r    ', '', ''],
            ['Janssen Boulevard', '6', 'r']
        ],
        [
            ['Galaxy Lane', '42', 'bis'],
            ['Galaxy Lane', '42', 'bis']
        ],
        [
            ['Plein 40-45', '3', 'A'],
            ['Plein 40-45', '3', 'A']
        ],
        [
            ['Plein 40-45', '3', 'ABC'],
            ['Plein 40-45', '3', 'ABC']
        ],
        [
            ['Plein 40-45', '3', 'Noord-Zuid'],
            ['Plein 40-45', '3', 'Noord-Zuid']
        ],
        [
            ['Plein 40-45 3-A', '', ''],
            ['Plein 40-45', '3', 'A']
        ],
        [
            ['Kempenaar 06', '12', ''],
            ['Kempenaar 06', '12', '']
        ],
        [
            ['Meerhovendreef', '90', ''],
            ['Meerhovendreef', '90', '']
        ],
        [
            ['Vestreåsen 335', '', ''],
            ['Vestreåsen', '335', '']
        ],
        [
            ['Travessa Morais, nº 323', '', ''],
            ['Travessa Morais', '323', '']
        ],
        // Typical French (ignored for now, return input):
        [
            ['95, impasse Théophile Roux', '', ''],
            ['95, impasse Théophile Roux', '', '']
        ]
    ];

    addresses.forEach(function (address, index) {
        it('should have addresslines splitted into street, house number and additional info ' + index, function () {
            var result = ingenicoPayloadHelpers.getSplittedAddress(address[0]);
            var expectedResult = address[1];
            assert.equal(result.street, expectedResult[0]);
            assert.equal(result.houseNumber, expectedResult[1]);
            assert.equal(result.additionalInfo, expectedResult[2]);
        });
    });
});
