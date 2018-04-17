'use strict';

const _ = require('lodash');
const qs = require('querystring');

// 配置 defaultQuery 时，自动 将merge成新的query：    customerQuery > defaultQuery.
exports.mergeQuery = function (url, defaultQuery, customerQuery, deleteCustomer) {
  let result = '';

  if (deleteCustomer) {
    defaultQuery = _.omit(defaultQuery, Object.keys(customerQuery));
  } else {
    Object.assign(defaultQuery, customerQuery);
  }
  let resultQuery = qs.encode(defaultQuery);
  let offset = url.indexOf('?');
  let prefix = offset === -1 ? url : url.substr(0, offset);
  result = resultQuery.length === 0 ? url : prefix + '?' + resultQuery;

  return result;
};