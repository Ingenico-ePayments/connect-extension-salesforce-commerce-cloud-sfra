module.exports = module.superModule;

/**
 * Processes billingForm on submitPayment
 * @param {Object} req Request object
 * @param {dw.web.FormElement} paymentForm form representing the payment
 * @param {Object} viewData Data passed around the request
 * @returns {Object} object containing an altered viewData
 */
function processForm(req, paymentForm, viewData) {
    try {
        var Locale = require('dw/util/Locale');

        viewData.paymentMethod = {
            value: paymentForm.paymentMethod.htmlValue,
            htmlName: paymentForm.paymentMethod.htmlName
        };

        viewData.paymentInformation = {
            paymentMethod: viewData.paymentMethod,
            customerLocaleId: Locale.getLocale(req.locale.id),
            securityCode: req.form.securityCode,
            storedPaymentUUID: req.form.storedPaymentUUID
        };
        return {
            viewData: viewData
        };
    } catch (err) {
        return {
            error: true,
            fieldErrors: 'Error processing payment form'
        };
    }
}

module.exports.processForm = processForm;
