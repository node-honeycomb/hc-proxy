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


exports.calculateHeaderExtension = function calculateHeaderExtension(req, serviceCfg) {
  const headers = {};
  if (serviceCfg.remoteApp) {
    headers['X-Remote-App'] = serviceCfg.remoteApp;
  }
  if (serviceCfg.rid) {
    headers['EagleEye-TraceId'] = serviceCfg.rid;
  }

  serviceCfg.headerExtension.forEach(e => {
    // 1. 如果是函数，直接执行
    // 2. 如果是string，加载内置的模块
    // 3. 如果是object，merge到headers
    if (typeof e === 'function') {
      Object.assign(headers, e(req, serviceCfg));
    } else if (typeof e === 'string') {
      try {
        const m = require('hc-service-client/lib/extension/' + e);
        Object.assign(headers, m(req, serviceCfg));
      } catch (e) {
        serviceCfg.log.error(e);
      }
    } else if (e && typeof e === 'object') {
      Object.assign(headers, e);
    }
  });

  return headers;
}

/**
 * 当出现errorCode将errorCode改写
 * @param {Error} err
 * @param {Response} res
 * @param {string|number} defaultErrorCode 默认覆盖的errorCode
 */
exports.errorHook = (err, res, defaultErrorCode) => {
  if(_.isNumber(defaultErrorCode) || _.isString(defaultErrorCode)){
    if(!err && res && res.statusCode){
      if(res.statusCode >= 500 && res.statusCode < 600){
        res.statusCode = defaultErrorCode;
      }
    }
  }
}