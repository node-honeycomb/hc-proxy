'use strict';

const urllib = require('urllib');
const pathToRegexp = require('path-to-regexp');
const qs = require('querystring');
const utils = require('./utils');
const url = require('url');
const formstream = require('formstream');

module.exports = function (u, proxyHeaders) {
  let endpoint = u.endpoint;
  let route = u.route;
  let method = u.method;
  let client = u.client;
  let timeout = u.timeout;

  let routeKeys = [];
  let routePathGrep = pathToRegexp(u.route, routeKeys);

  return (req, callback) => {
    let path = u.path;
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
    urllib.request(endpoint + path, options, function (err, data, res) {
      callback(err, res, 'stream');
    });
  }
}
