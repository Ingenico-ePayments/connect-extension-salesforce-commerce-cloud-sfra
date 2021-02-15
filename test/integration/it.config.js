'use strict';
require('dotenv').config();

module.exports = {
    baseUrl: 'https://' + global.baseUrl + '/on/demandware.store/Sites-RefArch-Site/en_US',
    suite: '*',
    reporter: 'spec',
    timeout: 60000,
    locale: 'x_default'
};
