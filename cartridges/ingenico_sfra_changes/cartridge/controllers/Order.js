'use strict';

var server = require('server');

server.extend(module.superModule);

server.append('Confirm', function (req, res, next) {
    res.setViewData({
        message: req.querystring.message
    });
    return next();
});

module.exports = server.exports();
