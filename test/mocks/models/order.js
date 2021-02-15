'use strict';

var proxyquire = require('proxyquire').noCallThru().noPreserveCache();

var proxyModel = function () {
    module.__proto__.superModule = function () {     // eslint-disable-line
        this.resources = {};
    };

    var model = proxyquire('../../../cartridges/ingenico_sfra_changes/cartridge/models/order', {
        'dw/web/Resource': {
            msg: function (key) {
                return key;
            }
        }
    });

    delete module.__proto__.superModule;     // eslint-disable-line

    return model;
};

module.exports = proxyModel();
