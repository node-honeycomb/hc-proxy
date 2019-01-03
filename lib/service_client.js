'use strict';

const pathToRegexp = require('path-to-regexp');
const url = require('url');
const qs = require('qs');
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
  let routePathGrep = pathToRegexp(u.route, routeKeys, utils.pathToRegexpOption);

  return (req, callback) => {
    let path = u.path;

    if (!accessKeySecret) {
      throw utils.errorWrapper('[hc-proxy]: service `' + u.serviceName + '` need a accessKeySecret / config.systemToken, but got undefined.');
    }

    let headers = Object.assign({}, utils.calculateHeaderExtension(req, Object.assign({}, u, u.serviceCfg)), u.headers);
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

    path = utils.processUrl(path, routeKeys, routePathGrep, req);

    // defaultParam 的支持部分post还是get
    let defaultQuery = u.defaultQuery instanceof Object ? u.defaultQuery : qs.parse(u.defaultQuery);
    let customerQuery = qs.parse(url.parse(req.url).query);
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

    if ('DELETE' === req.method && u.useQuerystringInDelete) {
      options.dataAsQueryString = true;
    }
    Object.assign(options, u.urllibOption);

    serviceClient.request(endpoint + path, options, function (err, data, res) {
      utils.errorHook(err, res, u.defaultErrorCode);
      callback(err, res, 'stream');
    });
  }
};

