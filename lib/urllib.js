'use strict';

const fs = require('fs');
const qs = require('qs');
const url = require('url');
const urllib = require('urllib');
const formstream = require('formstream');
const pathToRegexp = require('path-to-regexp');

const utils = require('./utils');

const debug = require('debug')('hc-proxy');

module.exports = function (u, proxyHeaders) {
  let log = u.log;
  let endpoint = u.endpoint;
  let route = u.route;
  let method = u.method;
  let client = u.client;
  let timeout = u.timeout;
  let beforeRequest = u.beforeRequest;
  let beforeResponse = u.beforeResponse;

  let routeKeys = [];
  let routePathGrep = pathToRegexp(u.route, routeKeys, utils.pathToRegexpOption);

  return (req, callback) => {
    let qpath = u.path;
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
    let headers = Object.assign({}, utils.calculateHeaderExtension(req, Object.assign({}, u, u.serviceCfg)), u.headers);
    Object.assign(options.headers, headers);

    qpath = utils.processUrl(qpath, routeKeys, routePathGrep, req);

    let defaultQuery = u.defaultQuery instanceof Object ? u.defaultQuery : qs.parse(u.defaultQuery);
    let customerQuery = qs.parse(url.parse(req.url).query);
    if (['GET', 'DELETE'].indexOf(req.method) !== -1) {
      qpath = utils.mergeQuery(qpath, defaultQuery, customerQuery, true);
    } else {
      qpath = utils.mergeQuery(qpath, defaultQuery, customerQuery);
    }

    const isUploadFile = u.file && req.files && req.files.length;

    /**
     * 清除 multer 中缓存到 /tmp 下的文件
     */
    const cleanTmpFile = () => {
      if(!isUploadFile) {
        return;
      }

      Array.isArray(req.files) && req.files.forEach(f => {
        const filepath = f.path;
        fs.unlink(filepath, (e) => log.warn(`clean multer cache file failed: ${e && e.message}`));
      });
    }

    // upload file
    if (isUploadFile) {
      const form = formstream();
      const data = options.data || {};
      Object.keys(data).forEach(k => {
        form.field(k, data[k]);
      });

      options.data = null;
      req.files.forEach(f => {
        const path = f.path;

        form.stream(f.fieldname, fs.createReadStream(path), f.originalname);
      });

      options.headers = form.headers(options.headers);
      options.stream = form;
    }

    if (!beforeResponse) {
      options.streaming = true;
    }
    if ('DELETE' === req.method && u.useQuerystringInDelete) {
      options.dataAsQueryString = true;
    }
    Object.assign(options, u.urllibOption);
    options.url = endpoint + qpath;

    if (beforeRequest) {
      beforeRequest(req, options, u);
    }

    log.info(`[hc-proxy] ${req.method} ${qpath} -> ${options.url}`);

    urllib.request(options.url, options, function (err, data, apiRes) {
      if (beforeResponse) {
        data = beforeResponse(req, apiRes, data);
        callback(err, data);
      } else {
        callback(err, apiRes, 'stream');
      }

      cleanTmpFile();
    });
  }
}
