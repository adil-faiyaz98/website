// @ts-check
/**
 * @fileoverview Utility exports for the VIM Invoice Validators library.
 */

const normalizers = require('./normalizers');
const stringMatching = require('./string-matching');
const confidence = require('./confidence');

module.exports = {
  ...normalizers,
  ...stringMatching,
  ...confidence
};
