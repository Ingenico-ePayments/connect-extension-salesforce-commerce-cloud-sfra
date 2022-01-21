'use strict';

/**
 * Render confirmation page
 * @param {response} res response object
 * @param {dw.order.Order} order that is linked to the checkout
 * @param {string} message optional message to be displayed to customer
 */
function renderConfirmationPage(res, order, message) {
    const URLUtils = require('dw/web/URLUtils');
    res.render('ingenico/confirm', {
        continueUrl: URLUtils.url('Order-Confirm').toString(),
        orderID: order.orderNo,
        orderToken: order.orderToken,
        message: message
    });
}

/**
 * Get payment method specific output from the payment object
 * @param {Object} payment Ingenico payment object
 * @returns {Object} paymentMethodSpecificOutput of the payment object
 */
function getPaymentMethodSpecificOutput(payment) {
    switch (payment.paymentMethod) {
        case 'bankTransfer': return payment.bankTransferPaymentMethodSpecificOutput;
        case 'card': return payment.cardPaymentMethodSpecificOutput;
        case 'cash': return payment.cashPaymentMethodSpecificOutput;
        case 'directDebit': // direct debit might be either sepa or direct debit
            return payment.directDebitPaymentMethodSpecificOutput
                ? payment.directDebitPaymentMethodSpecificOutput
                : payment.sepaDirectDebitPaymentMethodSpecificOutput;
        case 'eInvoice': return payment.eInvoicePaymentMethodSpecificOutput;
        case 'invoice': return payment.invoicePaymentMethodSpecificOutput;
        case 'redirect': return payment.redirectPaymentMethodSpecificOutput;
        default: return null;
    }
}

/**
 * Populate the relevant payment output on the payment transaction
 * The caller of this function must wrap this call in a transaction in order to persist the changes.
 * @param {dw.order.PaymentTransaction} paymentTransaction of the order
 * @param {{ status : string, paymentOutput: Object }} payment Ingenico payment object
 */
function populatePaymentTransactionWithPaymentOutput(paymentTransaction, payment) {
    const paymentMethodSpecificOutput = JSON.stringify(getPaymentMethodSpecificOutput(payment.paymentOutput));
    paymentTransaction.custom.ingenicoPaymentMethodSpecificOutput = paymentMethodSpecificOutput;
    paymentTransaction.custom.ingenicoResult = payment.status;
    paymentTransaction.custom.ingenicoTransactionId = payment.id;
    paymentTransaction.custom.ingenicoTransactionAmount = payment.paymentOutput.amountOfMoney.amount / 100;
    paymentTransaction.custom.ingenicoIsCancellable = payment.statusOutput.isCancellable;
    paymentTransaction.custom.ingenicoIsRefundable = payment.statusOutput.isRefundable;
}

module.exports = {
    renderConfirmationPage: renderConfirmationPage,
    populatePaymentTransactionWithPaymentOutput: populatePaymentTransactionWithPaymentOutput
};
