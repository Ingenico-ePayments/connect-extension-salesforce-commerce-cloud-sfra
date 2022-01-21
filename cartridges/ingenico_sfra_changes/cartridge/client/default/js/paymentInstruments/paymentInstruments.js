/* global jQuery $ session */
'use strict';

var formValidation = require('base/components/formValidation');
var cleave = require('base/components/cleave');
var ConnectSDK = require('../connect/connectsdk');

var url;

/**
 * Create an encrypted blob
 * @param {Object} session SDK session
 * @param {Object} cardDetails details of the card
 * @param {Object} address of the customer
 * @param {string} customerNumber id of the customer
 * @param {function} callback function
 */
function createEncryptedCustomerInput(session, cardDetails, address, customerNumber, callback) {
    var paymentDetails = {};
    session.getIinDetails(cardDetails.cardNumber, paymentDetails, true).then(function (iinDetailsResponse) {
        var paymentRequest = session.getPaymentRequest();
        paymentRequest.setPaymentProductId(iinDetailsResponse.paymentProductId);
        paymentRequest.setValue('cardNumber', cardDetails.cardNumber);
        paymentRequest.setValue('cardholderName', cardDetails.cardOwner);
        paymentRequest.setValue('expiryDate', cardDetails.expiryDate);
        paymentRequest.setValue('merchantCustomerId', customerNumber);
        paymentRequest.setValue('countryCode', address.country);
        paymentRequest.setValue('city', address.city);
        paymentRequest.setValue('street', address.address1);
        paymentRequest.setValue('zip', address.zip);
        session.getEncryptor().encrypt(paymentRequest, true).then(callback);
    }, function () {
        // eslint-disable-next-line no-console
        console.error('Failed getting IinDetails, check your credentials');
        return;
    });
}

module.exports = {
    removePayment: function () {
        $('.remove-payment').on('click', function (e) {
            e.preventDefault();
            url = $(this).data('url') + '?UUID=' + $(this).data('id');
            $('.payment-to-remove').empty().append($(this).data('card'));

            $('.delete-confirmation-btn').click(function (f) {
                f.preventDefault();
                $('.remove-payment').trigger('payment:remove', f);
                $.ajax({
                    url: url,
                    type: 'get',
                    dataType: 'json',
                    success: function (data) {
                        $('#uuid-' + data.UUID).remove();
                        if (data.message) {
                            var toInsert = '<div><h3>' +
                            data.message +
                            '</h3><div>';
                            $('.paymentInstruments').after(toInsert);
                        }
                    },
                    error: function (err) {
                        if (err.responseJSON.redirectUrl) {
                            window.location.href = err.responseJSON.redirectUrl;
                        }
                        $.spinner().stop();
                    }
                });
            });
        });
    },

    submitPayment: function () {
        $('form.payment-form').submit(function (e) {
            var $form = $(this);
            e.preventDefault();
            url = $form.attr('action');

            $form.spinner().start();
            $('form.payment-form').trigger('payment:submit', e);

            var clientSessionUrl = $form.attr('data-session-url');
            $.ajax({
                url: clientSessionUrl,
                type: 'get',
                dataType: 'json',
                success: function (context) {
                    var sessionDetails = {
                        clientSessionId: context.clientSessionId,
                        customerId: context.customerId,
                        clientApiUrl: context.clientApiUrl,
                        assetUrl: context.assetUrl
                    };

                    var expiryMonth = $('#month').val().length === 1 ? '0' + $('#month').val() : $('#month').val();
                    var expiryYear = $('#year').val().substring(2);
                    var cardDetails = {
                        cardNumber: $('#cardNumber').val().replace(/\s+/g, ''),
                        cardOwner: $('#cardOwner').val(),
                        expiryDate: expiryMonth + expiryYear
                    };
                    var addressDetails = {
                        address1: $('#address1').val(),
                        country: $('#country').val(),
                        city: $('#city').val(),
                        zip: $('#zipCode').val()
                    };
                    var customerNumber = $('input[name=customerNumber]').val();
                    var session = new ConnectSDK(sessionDetails);
                    createEncryptedCustomerInput(session, cardDetails, addressDetails, customerNumber, function (encryptedString) {
                        if (encryptedString) {
                            var formData = {
                                csrf_token: $('input[name=csrf_token]').val(),
                                customerEncryptedInput: encryptedString
                            };
                            $.ajax({
                                url: url,
                                type: 'post',
                                dataType: 'json',
                                data: formData,
                                success: function (data) {
                                    $form.spinner().stop();
                                    if (!data.success) {
                                        formValidation($form, data);
                                    } else {
                                        location.href = data.redirectUrl;
                                    }
                                },
                                error: function (err) {
                                    if (err.responseJSON.redirectUrl) {
                                        window.location.href = err.responseJSON.redirectUrl;
                                    }
                                    $form.spinner().stop();
                                }
                            });
                        } else {
                            $form.spinner().stop();
                            // show error message
                        }
                    });
                },
                error: function (err) {
                    // eslint-disable-next-line no-console
                    console.error(err);
                }
            });

            return false;
        });
    },

    handleCreditCardNumber: function () {
        if ($('#cardNumber').length && $('#cardType').length) {
            cleave.handleCreditCardNumber('#cardNumber', '#cardType');
        }
    }
};
