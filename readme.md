# hc-proxy

api代理模块，node server端代理请求后端service用。

## 以honeycomb项目为例进行配置

1. 确定honeycomb项目的启动端口和prefix，比如： 项目的启动端口为8001，prefix为 'example'
2. 整理远程调用的服务，给每个服务起个英文名称，比如： 上面的两个服务  视频服务(video)  音乐服务(music)  聊天服务(chat)
3. 配置在router.js中，进行如下配置
4. 请注意，为了确保安全，所有api只支持白名单
5. 333

```js
// router.js
const app = require('./app');
const Proxy = require('hc-proxy');
const proxyInstance = new Proxy({
  service: {
    video: {
      endpoint: 'http://localhost:7001/',
      client: 'http',
      api: [
        '/api/aaa',
        '/api/c/d'
      ]
    },
    music: {
      endpoint: 'http://192.168.1.1:7001/',
      client: 'http',
      api: [
        '/api/bbb'
      ]
    },
    dtboostTest: {
      endponit: 'http://localhost:8007/',
      client: 'serviceClient',
      api: [
        '/test',
      ],
      serviceOpt: { // client 代理时会合并以下配置
        pipe: false,
      },
    }
  },
  headers: [
    'x-csrf-token',
    'X-Operator'
  ]
});

// 代理的接口前缀  /api/proxy, 可以自定义
proxyInstance.setProxyPrefix('/api/proxy');

module.exports = function (router) {
  proxyInstance.mount(router, app);
};
```

### 配置完成后访问地址

访问地址为:
```
${服务地址:服务端口/prefix} + ${proxyPrefix} + ${被代理服务名} + ${具体api}
```

上面的配置案例里：
```shell
1. 视频服务:   curl http://localhost:8001/example/api/proxy/video/api/aaa => http://localhost:7001/api/aaa
2. 视频服务:   curl http://localhost:8001/example/api/proxy/video/api/c/somewhat?xxx=123 => http://localhost:7001/api/c/somewhat?xxx=123
3. 音乐服务:   curl http://localhost:8001/example/api/proxy/music/api/bbb => http://192.168.1.1:7001/api/bbb
```

### 代理websocket服务

```js
// router.js
const app = require('./app');
const Proxy = require('hc-proxy');
const proxyInstance = new Proxy({
  service: {
    music: {
      endpoint: 'http://192.168.1.1:7001/',
      client: 'http',
      api: [
        '/api/bbb'
      ]
    },
    chat: {
      endpoint: 'http://localhost:7001/',
      client: 'websocket',
      api: [
        '/ws/a'
      ]
    }
  },
  headers: [
    'x-csrf-token',
    'X-Operator'
  ]
});

proxyInstance.setProxyPrefix('/api/proxy');

module.exports = function (router) {
  proxyInstance.mount(router, app);
};
```

### websocket配置完成后访问地址

访问地址为 ${honeycomb服务地址:honeycomb服务端口/honeycomb的prefix} + ${proxyPrefix} + ${被代理服务名} + ${具体api}

```shell
1. 音乐服务:   curl http://localhost:8001/example/api/proxy/music/api/bbb => http://192.168.1.1:7001/api/bbb
2. 聊天服务:   curl http://localhost:8001/example/api/proxy/chat/ws/somewhat => http://localhost:7001/ws/somewhat      // 支持websocket
```

### 代理文件上传

```js
// router.js
const app = require('./app');
const Proxy = require('hc-proxy');
const proxyInstance = new Proxy({
  service: {
    music: {
      endpoint: 'http://192.168.1.1:7001/',
      client: 'http',
      api: [
        {
          path: '/api/404',
          return: 404
        },
        {
          path: '/api/upload',
          file: true
        },
        {
          path: '/api/upload_limited',
          file: {
            maxFileSize: 100        // 100B
          },
          beforeRequest: (req, options, config) => {},
          beforeResponse: (req, res, data) => {}
        }
      ]
    }
  },
  headers: [
    'x-csrf-token',
    'X-Operator'
  ]
});

proxyInstance.setProxyPrefix('/api/proxy');

module.exports = function (router) {
  proxyInstance.mount(router, app);
};
```

### 文件上传代理效果

```shell
1. 上传文件1:   curl http://localhost:8001/example/api/proxy/music/api/upload => http://192.168.1.1:7001/api/upload
2. 上传文件2:   curl http://localhost:8001/example/api/proxy/music/api/upload_limited => http://192.168.1.1:7001/api/upload_limited
```

## API document

约定:

- proxy挂在的http服务称为 "代理服务"
- 被proxy代理的远端服务称为 "远端服务"

### new Proxy(options)

#### options Object

options.service 详情

```
{
  ${serviceCode}: {
    /* 每个远端服务的服务地址，如: 'http://localhost:7001' */
    endpoint: ${endpoint},
    accessKeyId: ${accessKeyId},
    accessKeySecret: ${accessKeySecret},
    /* 同 hc-service-client 配置，见文档: https://www.npmjs.com/package/hc-service-client */
    headerExtension: ${headerExtension},
    /* 选填，透传的header列表，同 hc-service-client 配置，见文档: https://www.npmjs.com/package/hc-service-client */
    headers: {Array},
    /* 可选，发起请求的agent，目前只支持'appClient' / 'http' / 'websocket' / 'serviceWebsocket'，默认为'appClient'，其中 appClient 和 serviceWebsocket 带了honeycomb体系中的签名逻辑 */
    client: ${client},
    /* 接口超时时间，单位毫秒 */
    timeout: ${timeout},
    /* 可选，delete方法使用querystring代理, 默认为true */
    useQuerystringInDelete: ${useQuerystringInDelete}, // 只有 appClient / urllib 模式有效
    /* 可选，用户覆盖的urllibOption，覆盖系统默认值，优先级: service.api.urllibOption > service.urllibOption > hc-proxy默认设置 */
    urllibOption: {Object},                     // 只有 appClient / urllib 模式有效
    /* 覆盖转发时的5XX的errorCode */
    defaultErrorCode: {Number}
    /* 排除列表, 不代理的接口 */
    exclude: {Array}
    /* 路由前缀 */
    routePrefix: {String} 
    /* 是否开启路径支持正则匹配, 默认关闭，开启请确保安全 */
    enablePathWithMatch: {Boolean} false
    api: [
      /* 接口配置可以是简单的一个string */
      '${ApiPathString}',
      {
        /* api访问的path */
        path: {String}
        /* 如若定义，会覆盖proxyPrefix, 给特殊场景定义接口路径用 */
        route: {String}
        /* 接口方法 */
        method: 'GET|POST|PUT|DELETE|PATCH'
        /* 接口超时时间, 单位毫秒，覆盖上面配置的服务的通用超时，通常用来设置特殊接口的超时时长 */
        timeout: {Number},
        /* 是否透传, 开启透传之后，body不落地，直接pipe到远端； 开启pipe之后，body内容不参与签名(签名里的body='') */
        pipe: true,
        /* 请求的默认querystring信息， 用于配置默认的query参数(代理请求时自动加上) */
        defaultQuery: {Object|String},
        /**
         * 发起请求前的hook, beforeRequest(req, apiReq, config) 
         *    @param req {Request} 客户端请求对象request,
         *    @param options {Object} urlib的配置信息,
         *    @param config {Object} api的配置信息
         */
        beforeRequest: {Function(req, options, config)},
        /**
         * 请求从服务接口返回之后的hook，afterResponse(req, res, apiRes) 
         *  @param req {Request} 客户端请求的request对象,
         *  @param res {Response} proxy端请求的response对象,
         *  @param data {Response} 返回数据
         *  @return data
         */
        beforeResponse: {Function(req, res, data)}, 
        /* delete方法使用querystring代理, 默认为true */
        useQuerystringInDelete: {Boolean},
        /** 用户覆盖的urllibOption，覆盖系统默认值，优先级: service.api.urllibOption > service.urllibOption > hc-proxy默认设置 */
        urllibOption: {Object}
      }
    ]
  }
}
```

通用配置:

- headers: 选填，同 hc-service-client 配置，见文档: https://www.npmjs.com/package/hc-service-client
- accessKeyId: 选填，同 hc-service-client 配置，默认 'hc-proxy'，详见 https://www.npmjs.com/package/hc-service-client
- accessKeySecret: 同 hc-service-client 配置，必填，不填时取 app.config.systemToken，详见 https://www.npmjs.com/package/hc-service-client
- headerExtension:  同 hc-service-client 配置，见文档: https://www.npmjs.com/package/hc-service-client

#### options.headers Array<string>

options.headers 用于声明proxy需要转发的header。
默认情况下，proxy不转发客户端过来的header，只有在proxyHeaders中配置的header才会被转发。

### proxy.setProxyPrefix(proxyPrefix)

- proxyPrefix <String>

setProxyPrefix方法用于指定 hc-proxy 挂载在代理服务上的总前缀

如: 默认 proxyPrefix = /api/proxy 
则: 所有请求远端服务的请求，格式为   ${localHttpServer}/api/proxy/${serviceCode}/${remoteApi}

### proxy.mount(router, app)

将proxy的配置挂在到代理服务。

- router: Express Router instance
- app: app.server 是一个 http.Server 的实例，honeycomb中，直接 require('./app') 能获得

## 更多例子

```js
'use strict';

const app = require('./app');
const Proxy = require('hc-proxy');
const proxyInstance = new Proxy({
  service: {
    otm: {
      endpoint: 'http://dev.dtboost.biz.aliyun.test/otm_v2',                           // 自动截取最后的'/'
      client: 'appClient',                                                                // 默认appClient
      timeout: 10000,                                                                     // 默认60000
      api: [
        '/api/a',                                                                         // 支持 * 代理某个path下的所有api
        '/otm_v2/api/entities/list',                                                      // 代理这个 url 的 GET POST PUT DELETE 方法
        {path: '/otm_v2/api/entities/list', method: 'GET'},                                // 只代理 GET 方法
        {path: '/otm_v2/api/entities/list', client: 'appClient'},                          // 显式指定 method
        {path: '/otm_v2/api/schemas', method: ['GET', 'POST']},                            // 只支持 GET POST 方法
        {host: 'http://taobao.com/api', path: '/tag_factory_v2/api/:id', method: 'GET'},   // 不同域时，指定host
        {path: 'http://taobao.com/api', route: '/api/proxy/taobao_api'},                   // 指定route的代理，不指定route时，所有代理接口请求 /<-app_name->/api/proxy 获得代理
        '/otm_v2/api/tags/query_tags_entity_pagenum',                                     // 
        {path: '/otm_v2/api/schemas/:id', route: '/api/proxy/schemas/:id'}                 // 带参数的url，保证route和url中的param一致，也可以不填route
      ]
    },
    websocket: {
      endpoint: 'http://dev.dtboost.biz.aliyun.test/websocket',               // 远程的websocket地址
      client: 'websocket',                                                       // 选择websocket作为连接的client
      api: [
        '/ws'                                                                    // 配置连接路径，不在的路径返回404
      ]
    }
  },
  headers: [
    'x-csrf-token',
    'X-Operator'
  ]
});

proxyInstance.setProxyPrefix('/api/proxy');

module.exports = function (router) {
  proxyInstance.mount(router, app);
};
```

## DEBUG [代理没生效？]

在命令行启动命令前加入`DEBUG=hc-proxy`

```sh
// 以启动命令为 honeycomb start 为例
DEBUG=hc-proxy honeycomb start

// ...
// hc-proxy [GET] /api/proxy/urllib_proxy/urllib -> http://localhost:58062/urllib +0ms
// hc-proxy [POST] /api/proxy/urllib_proxy/urllib -> http://localhost:58062/urllib +3ms
// hc-proxy [DELETE] /api/proxy/urllib_proxy/urllib -> http://localhost:58062/urllib +1ms
// hc-proxy [PUT] /api/proxy/urllib_proxy/urllib -> http://localhost:58062/urllib +0ms
// ...
```

## 作用

- 本地开发时，可以使用这个代理访问远程其它服务(如otm)的问题；
- 非本地开发环境时，可以不使用代理，而直接访问类似'/otm_v2/api/xxx'，以减小内部调用开销，由前端自行控制；
