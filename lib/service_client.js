'use strict';

const pathToRegexp = require('path-to-regexp');
const url = require('url');
const qs = require('querystring');
const formstream = require('formstream');
const utils = require('./utils');
const ServiceClient = require('hc-service-client').ServiceClient;

module.exports = function (u, proxyHeaders) {
  let endpoint = u.endpoint;
  let route = u.route;
  let method = u.method;
  let client = u.client;
  let service = u.service;
  let timeout = u.timeout;
  let accessKeyId = u.accessKeyId || 'hc-proxy';
  let accessKeySecret = u.accessKeySecret;
  let headers = u.headers;
  let log = u.log || console;
  if (!log.debug) {
    log.debug = log.log;
  }

  let routeKeys = [];
  let routePathGrep = pathToRegexp(u.route, routeKeys);

  return (req, callback) => {
    let path = u.path;

    if (!accessKeySecret) {
      throw 'fault [hc-proxy]: service `' + u.serviceName + '` need a token.';
    }

    let headers = Object.assign({}, calculateHeaderExtension(req, Object.assign({}, u, u.serviceCfg)), u.headers);
    let serviceClient = new ServiceClient({
      endpoint,
      accessKeyId,
      accessKeySecret,
      headers,
      log
    });

    let options = {};
    options.method = req.method;
    options.data = ['GET', 'DELETE'].indexOf(req.method) !== -1 ? req.query : req.body;
    options.contentType = 'json';
    options.dataType = 'json';
    options.timeout = timeout || 60000;
    options.headers = {};
    proxyHeaders.map(h => {
      h = h.toLowerCase();
      if (req.headers[h]) {
        options.headers[h] = '' + req.headers[h];
      }
    });

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

    // defaultParam 的支持部分post还是get
    let defaultQuery = u.defaultQuery instanceof Object ? u.defaultQuery : qs.decode(u.defaultQuery);
    let customerQuery = qs.decode(url.parse(req.url).query);
    if (['GET', 'DELETE'].indexOf(req.method) !== -1) {
      path = utils.mergeQuery(path, defaultQuery, customerQuery, true);
    } else {
      path = utils.mergeQuery(path, defaultQuery, customerQuery);
    }

    // upload file
    if (u.file && req.files && req.files.length) {
      const form = formstream();
      const data = options.data || {};
      Object.keys(data).forEach(k => {
        form.field(k, data[k]);
      });
      options.data = null;
      req.files.forEach(f => {
        form.buffer(f.fieldname, f.buffer, f.originalname);
      });

      options.headers = form.headers(options.headers);
      options.stream = form;
    }

    options.streaming = true;
    serviceClient.request(endpoint + path, options, function (err, data, res) {
      callback(err, res, 'stream');
    });
  }
};

function calculateHeaderExtension(req, serviceCfg) {
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
