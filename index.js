'use strict';

const _ = require('lodash');
const http = require('http');
const url = require('url');
const multer = require('multer');
const pathToRegexp = require('path-to-regexp');
const utils = require('./lib/utils');
const debug = require('debug')('hc-proxy');

function trim (url) {
  if (_.endsWith(url, '/')) {
    return url.slice(0, -1);
  } else {
    return url;
  }
}

const clients  = {
  appClient: require('./lib/service_client'),
  serviceClient: require('./lib/service_client'),
  http: require('./lib/urllib'),
  websocket: require('./lib/websocket')
};
const methods = ['GET', 'POST', 'DELETE', 'PUT'];

const HcProxy = function (options) {
  if (!options.service) {
    throw utils.errorWrapper('[hc-proxy]: options.service is needed in options.');
  }
  this.proxyRules = options.service || {};
  this.proxyHeaders = options.headers || [];
  this.proxyPrefix = '/api/proxy';
};

HcProxy.prototype.setProxyPrefix = function (proxyPrefix) {
  if (typeof proxyPrefix !== 'string') {
    throw utils.errorWrapper('[hc-proxy]: setProxyPrefix only accept a string parameter, got: ' + proxyPrefix);
  }
  this.proxyPrefix = proxyPrefix;
};

HcProxy.prototype.mount = function (router, app) {
  if (!router) {
    throw utils.errorWrapper('[hc-proxy]: mount method should have `router`, but got one: ' + router);
  }
  if (!app) {
    throw utils.errorWrapper('[hc-proxy]: mount method should have two arguments `router`、`app`, but got one: ' + arguments);
  }
  const proxyRules = this.proxyRules;
  const proxyHeaders = this.proxyHeaders ? this.proxyHeaders : [];

  if (proxyRules.length) {
    proxyRules = {
      default: {
        endpoint: '',
        client: 'appClient',
        api: proxyRules
      }
    };
  }

  let keys = Object.keys(proxyRules);

  let wsHandler = [];
  keys.map(k => {
    let serviceName = k;
    let service = proxyRules[k];
    let api = service.api || ['/*'];
    let routePrefix = typeof service.routePrefix === 'string' ? service.routePrefix : this.proxyPrefix;
    
    // 黑名单
    let exclude = service.exclude || [];
    if (exclude.length > 0) {
      exclude.forEach((item) => {
        if (typeof item === 'object') {
          router[item.method.toLowerCase()](
            routePrefix + '/' + serviceName + item.path,
            function (req, res, next) {
              res.status(404).end();
            }
          );
        } else if (typeof item === 'string') {
          ['GET', 'POST', 'DELETE', 'PUT'].forEach((m) => {
            router[m.toLowerCase()](
              routePrefix + '/' + serviceName + item,
              function (req, res, next) {
                res.status(404).end();
              }
            );
          });
        }
      });
    }

    api.map(u => {
      if (typeof u === 'string') u = {path: u};
      let path = u.path ? trim(u.path) : '/*';
      let client = u.client || service.client || 'appClient';
      if (typeof u.method === 'string') u.method = [u.method];
      if (!u.method) u.method = client === 'websocket' ? ['GET'] : ['GET', 'POST', 'DELETE', 'PUT'];
      let method = u.method;
      let endpoint = u.endpoint || u.endPoint || u.host || service.endpoint || service.endPoint || '';
      if (!endpoint) {
        throw utils.errorWrapper(`[hc-proxy]: endpoint should not be empty, service: ${k}`);
      }

      if (!u.route) u.route = routePrefix + '/' + serviceName + u.path;
      let route = u.route;

      let timeout = u.timeout || service.timeout || 60000;
      let defaultQuery = u.defaultQuery;

      let accessKeyId = u.accessKeyId || service.accessKeyId || _.get(app, 'config.prefix');
      let accessKeySecret = u.accessKeySecret || service.accessKeySecret || _.get(app, 'config.systemToken');
      let headerExtension = u.headerExtension || service.headerExtension || [];
      let headers = u.headers || service.headers;
      let log = app && app.getLog() || console;
      let file = u.file || false;
      let useQuerystringInDelete = !_.isNil(service.useQuerystringInDelete) ? !!service.useQuerystringInDelete :
        !_.isNil(u.useQuerystringInDelete) ? !!u.useQuerystringInDelete : true;
      let urllibOption = Object.assign({}, service.urllibOption, u.urllibOption);

      return {
        serviceName,
        path,
        route,
        method,
        client,
        timeout,
        endpoint,
        defaultQuery,
        accessKeyId,
        accessKeySecret,
        headerExtension,
        headers,
        serviceCfg: service,
        log,
        file,
        useQuerystringInDelete,
        urllibOption
      };
    }).map(u => {
      let log = u.log;
      let serviceName = u.serviceName;
      let path = u.path;
      let route = u.route;
      let method = u.method;
      let client = u.client;
      let endpoint = u.endpoint;
      let file = u.file;
      if (!clients[client]) {
        return console.error('dtboost-proxy warning: there is no `client` called ' + client + '.');
      }

      method.map(m => {
        m = '' + m;
        m = m.toUpperCase();
        if (methods.indexOf(m) === -1) {
          return console.error('dtboost-proxy warning: there is no `method` called ' + client + '.');
        }
        if (u.client === 'websocket') {
          debug('[WEBSOCKET]', route, '->' ,(u.endpoint || '') + (u.path || ''));
          log.info('[WEBSOCKET]', route, '->' ,(u.endpoint || '') + (u.path || ''));
          return wsHandler.push({
            handler: clients[client](u, proxyHeaders),
            method,
            route,
            path
          });
        }

        log.info('[' + m + ']', route, '->' ,(u.endpoint || '') + (u.path || ''));
        debug('[' + m + ']', route, '->' ,(u.endpoint || '') + (u.path || ''));
        if (file) {
          if (['PUT', 'POST'].indexOf(m) === -1) {
            debug('[WARNING] file options should be used with PUT / POST method, current method is "' + m + '".');
          } else {
            router[m.toLowerCase()](
              route,
              function (req, res, next) {
                if (req._readableState.ended) {
                  return next();
                }
                multer({
                  storage: multer.memoryStorage(),
                  limits: {
                    fileSize: _.get(file, 'maxFileSize')
                  }
                }).any().apply(this, arguments);
              }
            );
          }
        }
        router[m.toLowerCase()](route, clients[client](u, proxyHeaders)
          , true   // 支持 framework5.0, 需要使用 isWrapper 来辨认是否是 callback 回调
        );
      });
    });
  });

  if (wsHandler.length > 0) {
    function addUpgradeListener() {
      app.server.on('upgrade', function (req, socket, head) {
        const urlInfo = url.parse(req.url);
        const requestPath = req.url;
        let path = '';
        const instance = wsHandler.reduce((origin, current) => {
          let routeKeys = [];
          let routePathGrep = pathToRegexp(app.options.prefix + current.route, routeKeys, utils.pathToRegexpOption);
          const match = routePathGrep.exec(urlInfo.pathname);
          if (match) {
            path = current.path;
            if (!req.params) {
              req.params = {};
            }
            routeKeys.forEach((k, idx) => {
              if (typeof k.name === 'string' && !req.params[k.name]) {
                req.params[k.name] = match[idx + 1];
              }
            });
            path = utils.processUrl(path, routeKeys, routePathGrep, req);
            return current;
          } else {
            return origin;
          }
        }, null);

        if (instance) {
          instance.handler(req, socket, head, path);
        } else {
          // 没有配置代理服务
          // socket.emit('error', new Error('Denied'));
          // socket.write('xxx');
          socket.write(
            ['HTTP/1.1 404 Not Found'].join('\r\n') + '\r\n\r\n'
          );
          // socket.destroy();
          socket.end();
        }
      });
    }
 
    if (!app) {
      throw utils.errorWrapper('[hc-proxy]: 使用websocket时请传入 honeybee app 实例:  dtboostProxy(router, app);');
    }
 
    if (app.server) {
      addUpgradeListener();
    } else {
      app.ready(() => {
        addUpgradeListener();
      });
    }
  }

  return router;
};

module.exports = HcProxy;
