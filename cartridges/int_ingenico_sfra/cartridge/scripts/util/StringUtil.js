/**
 * Apply padding to the start of the current string
 * @param {number} targetLength length of resulting string
 * @param {string} currentString string that needs to be padded with padString
 * @param {string} padString that will be applied to the start of the current string
 * @returns {string} padded string
 */
function padStart(targetLength, currentString, padString) {
    var timesToApply = targetLength - currentString.length;
    var padding = '';
    for (var i = 0; i < timesToApply; i++) {
        padding = padString + padding;
    }
    return padding + currentString;
}


module.exports = {
    padStart: padStart
};
