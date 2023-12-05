'use strict';
const fs = require('fs');
const qs = require('qs');
const url = require('url');
const formstream = require('formstream');
const pathToRegexp = require('path-to-regexp');
const ServiceClient = require('hc-service-client').ServiceClient;

const utils = require('./utils');

module.exports = function (u, proxyHeaders) {
  let endpoint = u.endpoint;
  let route = u.route;
  let method = u.method;
  let client = u.client;
  let service = u.serviceCfg;
  let timeout = u.timeout;
  let accessKeyId = u.accessKeyId || 'hc-proxy';
  let accessKeySecret = u.accessKeySecret;
  let _isIgnoreRequestFrom = service._isIgnoreRequestFrom;
  let log = u.log || console;
  let beforeRequest = u.beforeRequest;
  let beforeResponse = u.beforeResponse;
  let pipe = u.pipe;
  if (!log.debug) {
    log.debug = log.log;
  }

  let routeKeys = [];
  let routePathGrep = pathToRegexp(u.route, routeKeys, utils.pathToRegexpOption);

  return (req, callback) => {
    let qpath = u.path;

    if (!accessKeySecret) {
      throw utils.errorWrapper('[hc-proxy]: service `' + u.serviceName + '` need a accessKeySecret / config.systemToken, but got undefined.');
    }

    let headers = Object.assign({}, utils.calculateHeaderExtension(req, Object.assign({}, u, u.serviceCfg)), u.headers);
    
    // 强制加上安全标志
    if (!_isIgnoreRequestFrom) {
      headers['X-Requested-FROM'] = 'browser';
    }
    
    let serviceClient = new ServiceClient({
      endpoint,
      accessKeyId,
      accessKeySecret,
      headers,
      log
    });

    let options = {};
    options.pipe = pipe;
    options.method = req.method;
    if (!pipe) {
      options.data = ['GET', 'DELETE'].indexOf(req.method) !== -1 ? req.query : req.body;
    }
    options.contentType = 'json';
    options.dataType = pipe ? null : 'json';
    options.timeout = timeout || 60000;
    options.headers = {};
    proxyHeaders.map(h => {
      h = h.toLowerCase();
      if (req.headers[h]) {
        options.headers[h] = '' + req.headers[h];
      }
    });

    qpath = utils.processUrl(qpath, routeKeys, routePathGrep, req);

    // defaultParam 的支持部分post还是get
    let defaultQuery = u.defaultQuery instanceof Object ? u.defaultQuery : qs.parse(u.defaultQuery);
    let customerQuery = qs.parse(url.parse(req.url).query);
    if (['GET', 'DELETE'].indexOf(req.method) !== -1) {
      qpath = utils.mergeQuery(qpath, defaultQuery, customerQuery, true);
    } else {
      qpath = utils.mergeQuery(qpath, defaultQuery, customerQuery);
    }

    const isUploadFile = (u.file || (req.files && req.files.length)) && req.headers['content-type'].indexOf('multipart/form-data') !== -1;

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

    if (pipe) {
      options.headers = req.headers;
      options.stream = req;
    } else if (isUploadFile) {  // upload file
      const form = formstream();
      const data = options.data || {};
      Object.keys(data).forEach(k => {
        if(!data[k]) {
          return;
        }

        if(data[k].constructor === Object) {
          form.field(k, JSON.stringify(data[k]));

          return;
        }

        form.field(k, data[k]);
      });

      options.data = null;

      Array.isArray(req.files) && req.files.forEach(f => {
        const filepath = f.path;
        form.stream(f.fieldname, fs.createReadStream(filepath), f.originalname);
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

    if (u.moreDebuggerInfo) {
      const {filter} = u.moreDebuggerInfo;
      const {headers} = filter;
      let needLog = true;
      for (let header in headers) {
        if (!needLog) {
          break;
        }
        if (req.headers[header.toLocaleLowerCase()] !== headers[header]) {
          needLog = false;
        }
      }
      if (needLog) {
        log.info(`[moreDebugger] body -> ${JSON.stringify(req.body)} headers -> ${JSON.stringify(req.headers)}`)
      }
    }

    let optKeys = ['pipe'];
    optKeys.forEach((key) => {
      delete options[key];
    });


    Object.assign(options, u.serviceOpt);
    serviceClient.request(options.url, options, function (err, data, apiRes) {
      utils.errorHook(err, apiRes, u.defaultErrorCode);
      if (beforeResponse) {
        data = beforeResponse(req, apiRes, data);
        callback(err, data);
      } else {
        callback(err, apiRes, 'stream');
      }

      // 清理 multer tmp file
      cleanTmpFile();
    });
  }
};

