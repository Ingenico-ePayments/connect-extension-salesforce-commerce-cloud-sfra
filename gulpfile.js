/* eslint-env node, es6 */
const { series, src, dest } = require('gulp');
const del = require('del');

/**
 * clean
 * @returns {Promise} Promise resolved when package dir is cleaned
 */
function clean() {
    return del(['package/*/**', '!package/.git/**']);
}

/**
 * package
 * @returns {Stream} Package building stream
 */
function package() {
    return src([
        '**/*',
        '!node_modules/**',
        '!package/',
        '!documentation/*.docx',
        '!Dockerfile',
        '!gulpfile.js',
        '!.git/**'
    ], {
        dot: true
    }).pipe(dest('package/'));
}

module.exports = {
    package: series(clean, package)
};
