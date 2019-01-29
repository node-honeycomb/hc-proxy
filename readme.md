# service proxy

> api代理模块，解决跨域、权限问题

## 场景案例

远程需要被代理转发的服务:

```
http://localhost:7001/api/aaa         // 视频服务接口
http://localhost:7001/api/c/d        // 视频服务接口
http://192.168.1.1:7001/api/bbb       // 音乐服务接口
http://localhost:7001/ws/a            // 聊天服务接口 (使用websocket)
```

### 以honeycomb项目为例进行配置

1. 确定honeycomb项目的启动端口和prefix，比如： 项目的启动端口为8001，prefix为 'example'
2. 整理远程调用的服务，给每个服务起个英文名称，比如： 上面的两个服务  视频服务(video)  音乐服务(music)  聊天服务(chat)
3. 配置在router.js中，进行如下配置
4. 请注意，为了确保安全，所有api只支持白名单

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

### 配置完成后访问地址

访问地址为 ${honeycomb服务地址:honeycomb服务端口/honeycomb的prefix} + ${proxyPrefix} + ${被代理服务名} + ${具体api}

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
          path: '/api/upload',
          file: true
        },
        {
          path: '/api/upload_limited',
          file: {
            maxFileSize: 100        // 100B
          }
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
    endpoint: ${endpoint},
    accessKeyId: ${accessKeyId},
    accessKeySecret: ${accessKeySecret},
    headerExtension: ${headerExtension}，
    headers: ${headers},
    client: ${client},
    timeout: ${timeout},
    useQuerystringInDelete: ${useQuerystringInDelete},    // 只有 appClient / urllib 模式有效
    urllibOption: ${urllibOption},                        // 只有 appClient / urllib 模式有效
    defaultErrorCode: ${errorCode}                        // 覆盖5XX的errorCode
    api: [
      ${apiString},
      {
        path: ${path},
        route: ${route},
        method: ${method},
        timeout: ${apiTimeout},
        defaultQuery: ${defaultQuery},
        beforeRequest: ${beforeRequest}, // TODO
        useQuerystringInDelete: ${useQuerystringInDelete},
        urllibOption: ${urllibOption}
      }
    ]
  }
}
```

通用配置:

- endpoint: 每个远端服务的服务地址，如: 'http://localhost:7001' 或 'http://localhost:7001/service'
- client: 目前只支持'appClient' / 'http' / 'websocket'，默认为'appClient'，其中 appClient 带了honeycomb体系中的签名逻辑
- timeout: 某个服务或接口的超时时间，毫秒计算，默认60000
- apiString: 使用默认配置对某个api进行代理，设置的是Api的path，如: '/api/user' 会对 '/api/user' 进行 'GET', 'POST', 'PUT', 'PATCH', 'DELETE' 代理
- path: api的路径，如: '/api/user'，支持 '/api/user' / '/api/user/:user' / '/api/user/'
- route: api在路由中出现的路径(会忽略proxyPrefix)，如： '/remote_service/aaa' , 则调用 ${localService} + '/remote_service/aaa'，会被走path对应的远端服务
- method: 指定这个api支持的方法 'GET' / ['GET', 'POST']，不填时，默认为 ['GET', 'POST', 'PUT', 'PATCH', 'DELETE']
- apiTimeout: 覆盖整个服务的timeout
- defaultQuery: String / Object，用于配置默认的query参数(代理请求时自动加上)
- beforeRequest: 暂不支持
- file: 配置上传文件，出现上传文件配置时，该接口支持上传文件，子配置使用默认值可以配置为 {... file: true}
  - maxFileSize: 上传文件的大小限制, 单位byte, default
- useQuerystringInDelete: delete方法使用querystring代理, 默认为true
- urllibOption: 用户覆盖的urllibOption，覆盖系统默认值，优先级: service.api.urllibOption > service.urllibOption > hc-proxy默认设置
- defaultErrorCode: 覆盖转发时的5XX的errorCode

client=[appClient/serviceClient]的专属配置

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
