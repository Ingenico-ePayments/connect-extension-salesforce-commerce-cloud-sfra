'use strict';

var server = require('server');

server.extend(module.superModule);

server.append('Begin', function (req, res, next) {
    res.setViewData({
        paymentError: req.querystring.paymentError
    });
    return next();
});

module.exports = server.exports();
