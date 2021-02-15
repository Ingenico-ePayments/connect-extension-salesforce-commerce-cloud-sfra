'use strict';

/* eslint no-unused-vars: */
/* global jQuery $ */

/**
 * Disable the loading overlay
 */
function disableOverlay() {
    jQuery('.overlay').toggleClass('show').html('');
}

/**
 * Enable the loading overlay
 */
function enableOverlay() {
    jQuery('.overlay').toggleClass('show').html('<div class="loader">Loading...</div>');
}

/**
 * Perform AJAX call
 * @param {Object} data that needs to be sent to the server
 */
function performAjaxCall(data) {
    var actionUrl = jQuery('[id="actionControllerUrl"]').val();
    var errorMessage = jQuery('[id="errorMessage"]').val();

    enableOverlay();
    jQuery.ajax({
        type: 'GET',
        url: actionUrl,
        data: data,
        dataType: 'json',
        success: function (data) {
            if (!data || data.error) {
                jQuery('.overlay').html("<div class='result error'>" + errorMessage + '<span>' + data.json.errors[0].message + '</span></div>');
                setTimeout(function () {
                    disableOverlay();
                }, 3000);
                return;
            }
            disableOverlay();
        },
        error: function (request, status, error) {
            // eslint-disable-next-line no-console
            console.log(error);
            disableOverlay();
        },
        complete: function () {
            jQuery('.payment_info_container').load(window.location.href + ' .payment_info_container');
        }
    });
}

/**
 * Get the latest payment status
 * @param {jQuery} event jquery event
 * @param {string} orderNumber of the order
 * @param {string} paymentId of the payment transaction
 */
function updatePaymentStatus(event, orderNumber, paymentId) {
    if (event) {
        event.stopPropagation();
        event.preventDefault();
    }

    var data = {
        action: 'paymentStatus',
        orderNumber: orderNumber,
        paymentId: paymentId
    };
    performAjaxCall(data);
}

/**
 * Approve the payment
 * @param {jQuery} event jquery event
 * @param {string} orderNumber of the order
 * @param {string} paymentId of the payment transaction
 */
function approvePayment(event, orderNumber, paymentId) {
    if (event) {
        event.stopPropagation();
        event.preventDefault();
    }

    var data = {
        action: 'approvePayment',
        orderNumber: orderNumber,
        paymentId: paymentId
    };
    performAjaxCall(data);
}

/**
 * Cancel the payment
 * @param {jQuery} event jquery event
 * @param {string} paymentId of the payment transaction
 */
function cancelPayment(event, paymentId) {
    if (event) {
        event.stopPropagation();
        event.preventDefault();
    }

    var data = {
        action: 'cancelPayment',
        paymentId: paymentId
    };
    performAjaxCall(data);
}

/**
 * Close a modal
 * @param {jQuery} event jQuery event
 */
function closeModal(event) {
    if (event) {
        event.stopPropagation();
        event.preventDefault();
    }
    disableOverlay();
}

jQuery(window).ready(function () {
    var orderNumber = jQuery('[id="orderNumber"]').val();
    var orderStatus = jQuery('[id="orderStatus"]').val();
    // update payment status if the order is OPEN
    if (orderStatus === 'OPEN') {
        var data = {
            action: 'paymentStatus',
            orderNumber: orderNumber
        };
        var actionUrl = jQuery('[id="actionControllerUrl"]').val();
        var errorMessage = jQuery('[id="errorMessage"]').val();

        enableOverlay();
        jQuery.ajax({
            type: 'GET',
            url: actionUrl,
            data: data,
            success: function (data) {
                if (!data) {
                    return;
                }

                if (data.error) {
                    jQuery('.overlay').html("<div class='result error'>" + errorMessage + '<span>' + data.json.errors[0].message + '</span></div>');
                    setTimeout(function () {
                        disableOverlay();
                    }, 3000);
                }
                disableOverlay();
            },
            error: function (request, status, error) {
                // eslint-disable-next-line no-console
                console.log(error);
                disableOverlay();
            },
            complete: function () {
                jQuery('.payment_info_container').load(window.location.href + ' .payment_info_container');
            }
        });
    }
});
