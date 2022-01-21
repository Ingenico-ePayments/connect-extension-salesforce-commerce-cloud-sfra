'use strict';

var server = require('server');

server.extend(module.superModule);

server.prepend('Start', function (req, res, next) {
    const URLRedirectMgr = require('dw/web/URLRedirectMgr');
    const ingenicoPreferences = require('*/cartridge/scripts/ingenicoPreferences');

    if (URLRedirectMgr.getRedirectOrigin() === '/.well-known/apple-developer-merchantid-domain-association') {
        var domainVerificationString = ingenicoPreferences.getApplePayDomainVerificationString();
        response.writer.print(domainVerificationString);
    } else {
        next();
    }
});

module.exports = server.exports();
