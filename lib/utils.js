'use strict';

const _ = require('lodash');
const qs = require('qs');

// 配置 defaultQuery 时，自动 将merge成新的query：    customerQuery > defaultQuery.
exports.mergeQuery = function (url, defaultQuery, customerQuery, deleteCustomer) {
  let result = '';

  if (deleteCustomer) {
    defaultQuery = _.omit(defaultQuery, Object.keys(customerQuery));
  } else {
    Object.assign(defaultQuery, customerQuery);
  }
  let resultQuery = qs.stringify(defaultQuery);
  let offset = url.indexOf('?');
  let prefix = offset === -1 ? url : url.substr(0, offset);
  result = resultQuery.length === 0 ? url : prefix + '?' + resultQuery;

  return result;
};

exports.errorWrapper = function (message) {
  const err = new Error(message);
  err.code = 'HC_PROXY_ERROR';

  return err;
};

exports.processUrl = function (originalPath, routeKeys, routePathGrep, req) {
  let path = originalPath;

  // /path/:id 的情况需要进行变量替换
  let reqParams = req.params || {};
  routeKeys.forEach(k => {
    if (typeof k.name === 'string') {
      path = path.replace(':' + k.name, reqParams[k.name]);
    }
  });

  // /path/* 的情况需要进行path替换
  routeKeys.forEach((k, idx) => {
    if (typeof k.name === 'number') {
      // 这里取的是 req.url 原因是u.route是挂载在/${app-name}后的,
      // 进来的req.url刚好跟u.route匹配,req.originalUrl包含/${app-name},exec时不匹配。
      let greps = routePathGrep.exec(req.url);
      greps.shift();
      path = path.replace('*', greps[idx]);
      path = path.split('?')[0];
    }
  });

  return path;
};

exports.pathToRegexpOption = {
  sensitive: true
};

