'use strict';

var processInclude = require('base/util');

$(document).ready(function () {
    var errorMessageText = $('.error-message-text').text();
    // If an error is rendered server side, show it
    if (errorMessageText && errorMessageText.trim() !== '') {
        $('.error-message').show();
    }
    processInclude(require('./checkout/checkout'));
    $('body').on('checkout:serializeBilling', function (e, obj) {
        var params = $(obj.form).serializeArray();
        var radios = obj.form.find('input[type=radio]').toArray()
            .map(function (el) { return el.name; });
        var radioSets = radios.reduce(function (map, name) {
            map[name] = true;
            return map;
        }, {});
        params.forEach(function (param) {
            delete radioSets[param.name];
        });
        Object.keys(radioSets).forEach(function (radioSet) {
            params.push({
                name: radioSet,
                value: ''
            });
        });
        obj.callback($.param(params));
    });
});
