/* global jQuery $ */
'use strict';

var formValidation = require('base/components/formValidation');

$(document).ready(function () {
    var errorMessageText = $('.error-message-text').text();
    // If an error is rendered server side, show it
    if (errorMessageText && errorMessageText.trim() !== '') {
        $('.error-message').show();
    }
    $('form.checkout-registration').submit(function (e) {
        var form = $(this);
        e.preventDefault();
        var url = form.attr('action');
        form.spinner().start();
        $.ajax({
            url: url,
            type: 'post',
            dataType: 'json',
            data: form.serialize(),
            success: function (data) {
                form.spinner().stop();
                if (!data.success) {
                    formValidation(form, data);
                } else {
                    location.href = data.redirectUrl;
                }
            },
            error: function (err) {
                if (err.responseJSON.redirectUrl) {
                    window.location.href = err.responseJSON.redirectUrl;
                }
                form.spinner().stop();
            }
        });
        return false;
    });
});
