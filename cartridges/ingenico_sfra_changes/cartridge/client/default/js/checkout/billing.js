/* global jQuery $ */

'use strict';

var addressHelpers = require('base/checkout/address');

/**
 * Create an encrypted blob
 * @param {Object} session SDK session
 * @param {Object} cardDetails details of the card
 * @param {Object} paymentDetails details of the payment
 * @param {requestCallback} callback function that will handle the encrypted customer input
 */
function createEncryptedCustomerInput(session, cardDetails, paymentDetails, callback) {
    if (session) {
        session.getIinDetails(cardDetails.cardNumber, paymentDetails).then(function (iinDetailsResponse) {
            if (iinDetailsResponse.status !== 'SUPPORTED') {
                $('#checkout-main').prepend('<div class="row"><div class="col-sm-7"><div class="alert text-center alert-danger">Your card is not supported. Please use another.</div></div></div>');
                return;
            }
            session.getPaymentProduct(iinDetailsResponse.paymentProductId, paymentDetails).then(function (paymentProduct) {
                var paymentRequest = session.getPaymentRequest();
                paymentRequest.setPaymentProduct(paymentProduct);
                paymentRequest.setPaymentProductId(paymentProduct.id);
                paymentRequest.setValue('cardNumber', cardDetails.cardNumber);
                paymentRequest.setValue('cardholderName', cardDetails.cardOwner);
                paymentRequest.setValue('expiryDate', cardDetails.expiryDate);
                paymentRequest.setValue('cvv', cardDetails.cvv);

                if (!paymentRequest.isValid()) {
                    $('#checkout-main').prepend('<div class="row"><div class="col-sm-7"><div class="alert text-center alert-danger">Please check your card details.</div></div></div>');
                    // enable the next:Place Order button here
                    $('body').trigger('checkout:enableButton', '.next-step-button button');
                    return;
                }
                session.getEncryptor().encrypt(paymentRequest).then(callback);
            }, function () {
                $('#checkout-main').prepend('<div class="row"><div class="col-sm-7"><div class="alert text-center alert-danger">Please check your card details.</div></div></div>');
                // enable the next:Place Order button here
                $('body').trigger('checkout:enableButton', '.next-step-button button');
                return;
            });
        }, function () {
            $('#checkout-main').prepend('<div class="row"><div class="col-sm-7"><div class="alert text-center alert-danger">Please check your card details.</div></div></div>');
            // enable the next:Place Order button here
            $('body').trigger('checkout:enableButton', '.next-step-button button');
            return;
        });
    }
}

/**
 * Create an encrypted blob for cvv code
 * @param {Object} session SDK session
 * @param {Object} cardDetails details of the card
 * @param {requestCallback} callback function that will handle the encrypted customer input
 */
function createEncryptedCustomerInputForCvv(session, cardDetails, callback) {
    if (session) {
        var paymentRequest = session.getPaymentRequest();
        paymentRequest.setPaymentProductId(cardDetails.paymentProductId);
        paymentRequest.setValue('cvv', cardDetails.cvv);
        session.getEncryptor().encrypt(paymentRequest, true).then(callback);
    }
}

/**
 * updates the billing address selector within billing forms
 * @param {Object} order - the order model
 * @param {Object} customer - the customer model
 */
function updateBillingAddressSelector(order, customer) {
    var shippings = order.shipping;

    var form = $('form[name$=billing]')[0];
    var $billingAddressSelector = $('.addressSelector', form);
    var hasSelectedAddress = false;

    if ($billingAddressSelector && $billingAddressSelector.length === 1) {
        $billingAddressSelector.empty();
        // Add New Address option
        $billingAddressSelector.append(addressHelpers.methods.optionValueForAddress(
            null,
            false,
            order,
            { type: 'billing' }));

        // Separator -
        $billingAddressSelector.append(addressHelpers.methods.optionValueForAddress(
            order.resources.shippingAddresses, false, order, {
                // className: 'multi-shipping',
                type: 'billing'
            }
        ));

        shippings.forEach(function (aShipping) {
            var isSelected = order.billing.matchingAddressId === aShipping.UUID;
            hasSelectedAddress = hasSelectedAddress || isSelected;
            // Shipping Address option
            $billingAddressSelector.append(
                addressHelpers.methods.optionValueForAddress(aShipping, isSelected, order,
                    {
                        // className: 'multi-shipping',
                        type: 'billing'
                    }
                )
            );
        });

        if (customer.addresses && customer.addresses.length > 0) {
            $billingAddressSelector.append(addressHelpers.methods.optionValueForAddress(
                order.resources.accountAddresses, false, order));
            customer.addresses.forEach(function (address) {
                var isSelected = order.billing.matchingAddressId === address.ID;
                hasSelectedAddress = hasSelectedAddress || isSelected;
                // Customer Address option
                $billingAddressSelector.append(
                    addressHelpers.methods.optionValueForAddress({
                        UUID: 'ab_' + address.ID,
                        shippingAddress: address
                    }, isSelected, order, { type: 'billing' })
                );
            });
        }
    }

    if (hasSelectedAddress
        || (!order.billing.matchingAddressId && order.billing.billingAddress.address)) {
        // show
        $(form).attr('data-address-mode', 'edit');
    } else {
        $(form).attr('data-address-mode', 'new');
    }

    $billingAddressSelector.show();
}

/**
 * updates the billing address form values within payment forms
 * @param {Object} order - the order model
 */
function updateBillingAddressFormValues(order) {
    var billing = order.billing;
    if (!billing.billingAddress || !billing.billingAddress.address) return;

    var form = $('form[name=dwfrm_billing]');
    if (!form) return;

    $('input[name$=_firstName]', form).val(billing.billingAddress.address.firstName);
    $('input[name$=_lastName]', form).val(billing.billingAddress.address.lastName);
    $('input[name$=_address1]', form).val(billing.billingAddress.address.address1);
    $('input[name$=_address2]', form).val(billing.billingAddress.address.address2);
    $('input[name$=_city]', form).val(billing.billingAddress.address.city);
    $('input[name$=_postalCode]', form).val(billing.billingAddress.address.postalCode);
    $('select[name$=_stateCode],input[name$=_stateCode]', form)
        .val(billing.billingAddress.address.stateCode);
    $('select[name$=_country]', form).val(billing.billingAddress.address.countryCode.value);
    $('input[name$=_phone]', form).val(billing.billingAddress.address.phone);
    $('input[name$=_email]', form).val(order.orderEmail);
}

/**
 * clears the billing address form values
 */
function clearBillingAddressFormValues() {
    updateBillingAddressFormValues({
        billing: {
            billingAddress: {
                address: {
                    countryCode: {}
                }
            }
        }
    });
}

/**
 * Updates the billing information in checkout, based on the supplied order model
 * @param {Object} order - checkout model to use as basis of new truth
 * @param {Object} customer - customer model to use as basis of new truth
 * @param {Object} [options] - options
 */
function updateBillingInformation(order, customer) {
    updateBillingAddressSelector(order, customer);

    // update billing address form
    updateBillingAddressFormValues(order);

    // update billing address summary
    addressHelpers.methods.populateAddressSummary('.billing .address-summary',
        order.billing.billingAddress.address);

    // update billing parts of order summary
    $('.order-summary-email').text(order.orderEmail);

    if (order.billing.billingAddress.address) {
        $('.order-summary-phone').text(order.billing.billingAddress.address.phone);
    }
}

/**
 * Updates the payment information in checkout, based on the supplied order model
 * @param {Object} order - checkout model to use as basis of new truth
 */
function updatePaymentInformation(order) {
    // update payment details
    var $paymentSummary = $('.payment-details');
    var htmlToAppend = '';

    if (order.billing.payment && order.billing.payment.selectedPaymentInstruments
        && order.billing.payment.selectedPaymentInstruments.length > 0) {
        switch (order.billing.payment.selectedPaymentInstruments[0].paymentMethod) {
            case 'HOSTED_CREDIT_CARD':
                htmlToAppend += '<span>' + order.resources.paymentTypeHostedCreditCard + '</span>';
                break;
            case 'IDEAL':
                htmlToAppend += '<span>' + order.resources.paymentTypeIdeal + '</span>';
                break;
            case 'TRUSTLY':
                htmlToAppend += '<span>' + order.resources.paymentTypeTrustly + '</span>';
                break;
            case 'PAYPAL':
                htmlToAppend += '<span>' + order.resources.paymentTypePayPal + '</span>';
                break;
            case 'CREDIT_CARD':
                htmlToAppend += '<span>' + order.resources.paymentTypeCreditCard + '</span>';
                break;
            default:
        }
    }
    $paymentSummary.empty().append(htmlToAppend);
}

module.exports = {
    methods: {
        updateBillingAddressSelector: updateBillingAddressSelector,
        updateBillingAddressFormValues: updateBillingAddressFormValues,
        clearBillingAddressFormValues: clearBillingAddressFormValues,
        updateBillingInformation: updateBillingInformation,
        updatePaymentInformation: updatePaymentInformation
    },

    showBillingDetails: function () {
        $('.btn-show-billing-details').on('click', function () {
            $(this).parents('[data-address-mode]').attr('data-address-mode', 'new');
        });
    },

    hideBillingDetails: function () {
        $('.btn-hide-billing-details').on('click', function () {
            $(this).parents('[data-address-mode]').attr('data-address-mode', 'shipment');
        });
    },

    selectBillingAddress: function () {
        $('.payment-form .addressSelector').on('change', function () {
            var form = $(this).parents('form')[0];
            var selectedOption = $('option:selected', this);
            var optionID = selectedOption[0].value;

            if (optionID === 'new') {
                // Show Address
                $(form).attr('data-address-mode', 'new');
            } else {
                // Hide Address
                $(form).attr('data-address-mode', 'shipment');
            }

            // Copy fields
            var attrs = selectedOption.data();
            var element;

            Object.keys(attrs).forEach(function (attr) {
                element = attr === 'countryCode' ? 'country' : attr;
                $('[name$=' + element + ']', form).val(attrs[attr]);
            });
        });
    },

    selectSavedPaymentInstrument: function () {
        $(document).on('click', '.saved-payment-instrument', function (e) {
            e.preventDefault();
            $('.saved-payment-security-code').val('');
            $('.saved-payment-instrument').removeClass('selected-payment');
            $(this).addClass('selected-payment');
            $('.saved-payment-instrument .card-image').removeClass('checkout-hidden');
            $('.saved-payment-instrument .security-code-input').addClass('checkout-hidden');
            $('.saved-payment-instrument.selected-payment' +
                ' .card-image').addClass('checkout-hidden');
            $('.saved-payment-instrument.selected-payment ' +
                '.security-code-input').removeClass('checkout-hidden');
        });
    },

    addNewPaymentInstrument: function () {
        $('.btn.add-payment').on('click', function (e) {
            e.preventDefault();
            $('.payment-information').data('is-new-payment', true);
            $('.credit-card-form').removeClass('checkout-hidden');
            $('.user-payment-instruments').addClass('checkout-hidden');
        });
    },

    cancelNewPayment: function () {
        $('.cancel-new-payment').on('click', function (e) {
            e.preventDefault();
            $('.payment-information').data('is-new-payment', false);
            $('.user-payment-instruments').removeClass('checkout-hidden');
            $('.credit-card-form').addClass('checkout-hidden');
        });
    },

    clearBillingForm: function () {
        $('body').on('checkout:clearBillingForm', function () {
            clearBillingAddressFormValues();
        });
    },

    paymentTabs: function () {
        $('.payment-options .nav-item').on('click', function (e) {
            e.preventDefault();
            var methodID = $(this).data('method-id');
            $('.payment-information').data('payment-method-id', methodID);
        }).on('show.bs.tab', function (e) {
            $(e.target.hash).prop('disabled', false);
            $(e.relatedTarget.hash).prop('disabled', true);
        });
    },
    createEncryptedCustomerInput: createEncryptedCustomerInput,
    createEncryptedCustomerInputForCvv: createEncryptedCustomerInputForCvv
};
