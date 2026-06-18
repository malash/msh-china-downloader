# CLAUDE.md

这是一个 MSH
China（明医保险）保险理赔下载器。它用你的账号登录后，遍历账户下每一位被保险人、每一个保单年度，把名下**全部**理赔——文字详情和附件图片——抓取下来，生成一个可以完全离线浏览的本地站点。

它没有用任何官方开放接口，因为根本不存在这样的接口。整套协议都是从微信端 H5（`https://wechat.mshasia.com/wechat/`）的前端 bundle（`app.<hash>.js`）里逆向出来的。这份文档的核心，就是把这套逆向得到的协议讲清楚——理解了它，你应该能从零重新实现这个项目。

## 协议原理

后端的接口都挂在 `https://wechat.mshasia.com/appwechat/`
下，请求和响应都做了签名与加密。下面从外到内逐层拆解。

### 第一层：请求签名

每个请求都必须带三个 header：`timestamp`、`nonce`、`signature`，否则会被拒。

签名算法是 HMAC-SHA256：

```
signature = HMAC-SHA256(secret, `${timestamp}&${nonce}&${body}${query}`)   // 输出 hex
```

其中 `timestamp` 是毫秒级时间戳（`Date.now()`），`nonce` 是随机 UUID，`body` 是请求体的
`JSON.stringify` 结果。对 POST 请求，末尾的 `query` 固定为字符串
`"{}"`，而且 body 和 query 之间**直接拼接、没有任何分隔符**——这一点很容易写错。

这里的 `secret`
并不是真正的秘密：它硬编码在前端 bundle 里。唯一的小障碍是它被拆成两段字符串字面量拼接而成，所以完整值不会在 bundle 里原样出现，逆向时要搜它的头部和尾部子串。这个值放在环境变量
`SIGNATURE_SECRET`（`.env.example` 里附了一份可用的）。`src/auth/secret-check.ts`
会在启动时拉取线上 bundle，检查 secret 的头尾子串是否还在——如果不在，说明它可能被轮换了，打一条警告（但不阻断运行）。

### 第二层：会话密钥协商（`/com/separated/ra`）

凡是涉及敏感数据的接口（登录、理赔详情），参数都要加密，而加密用的密钥是一次性协商出来的。

流程是：先 POST `/appwechat/com/separated/ra`，body 为
`{ uuid }`（uuid 是前端随机生成的 32 位十六进制串）。服务端返回一个 `result`
数组，里面藏着这一轮会话的密钥材料，但都做了混淆：

- `result[1]` —— 一把 1024 位 RSA 公钥。混淆方式是：先把 `! @ # $ % ^ & *` 这八个符号分别还原成数字
  `1 2 3 4 5 6 7 8`，再把字符串前后两半对调（如果总长是奇数，末尾那个字符单独摘出、最后补回）。还原后就是一段标准 SPKI
  DER 格式的 base64 公钥。
- `result[2]` —— AES 的 IV（16 字符），用映射 `@→W *→K !→1` 还原。
- `result[5]` —— AES 的 key（16 字符），用映射 `#→W =→Y $→4` 还原。
- `result[0]`、`result[3]`、`result[4]` 没有用到。

拿到这套材料后：AES 用 **AES-128-CBC + PKCS7**，key 和 iv 都按 16 字节的原始 UTF-8 直接使用；RSA 用
**PKCS#1 v1.5** padding。这些都封装在 `src/crypto/cipher.ts` 里（`buildSession`
负责反混淆和构造会话，`rsaEncrypt` / `encryptParam` / `decryptResult` / `encryptJson`
是各种加解密原语）。

服务端不靠 cookie 绑定会话——下发的这套 key/iv 在一段时间内是全局有效的，所以客户端完全不需要维护 cookie。

但"全局有效"不等于"会话可复用"：协商时用的 `uuid` 会和这次协商绑定，对 `/claim/detail`
这类敏感接口是**一次性 nonce**。实测过：一个 `uuid`+会话第一次调 detail 成功，**第二次复用就会
`-999999999 您正在进行非法请求`**；换个 uuid 配旧会话也一样被拒。所以 `/separated/ra` 与
`/claim/detail` 是强制 1:1，每条理赔必须各自重新协商——别想着缓存一个会话跑完所有理赔来省那些
`/separated/ra` 往返，行不通。

### 第三层：参数加密的不对称性

这是整套协议里最反直觉、最容易出错的地方。理赔详情接口需要的是 RSA 加密后的参数，但不同参数的
**原始形态不一样**，因此加密方式也不一样：

- 理赔列表返回的 **claimNo 是明文**（比如 `NDB2826880`），所以直接 RSA 加密即可（`rsaEncrypt`）。
- 理赔列表返回的 **employeeId 是 AES 密文**，必须先用会话密钥 AES 解密成明文，再 RSA 加密（这正是
  `encryptParam` 做的：先 AES 解密，再 RSA 加密）。
- 网页 URL query string 里的 claimNo/employeeId
  **也是 AES 密文**，所以早期"单条理赔"的代码路径里两个参数都走 `encryptParam`。

如果把这两种处理方式搞混（比如把明文 claimNo 也拿去 AES 解密），服务端会返回
`code: -999999999`、`您正在进行非法请求`。

### 登录（`/separated/isolationLogin`）

登录是个特例：它**只用 AES，完全不用 RSA**。把用户名密码等字段组成一个 JSON 对象，整体用会话 key/iv 做 AES-128-CBC 加密，密文作为
`securityData` 字段发出去。明文对象的结构是：

```
{ account, password, verifyCode: '', sign: '', openId: '', language: 'zh_cn',
  from: 'app', registrationID: '', appVersion: '', deviceName }
```

响应同样是 AES 密文，用同一套 key/iv 解开。

`deviceName` 这个字段值得专门说明——它是服务端做单点登录用的**会话指纹**。两次登录如果用了
**相同的 deviceName**，后一次会把前一次顶下线。（注意验证顶号要用 `getPersonalInfo` 这种**有状态**
接口；`getDefaultPolicy`
是无状态的，token 即使被顶了它照样返回成功，看不出来。）网页端的 deviceName 是从设备型号派生的，桌面浏览器下取到的是空字符串，所以网页之间会互相顶号。我们的脚本特意发一个**随机**
deviceName，这样它和用户正在用的浏览器各占一个会话槽，永远不会把对方挤掉。

### Token 与登录状态

登录成功返回一个 JWT。我们把它缓存在项目根目录的 `.token`
文件里，下次运行先读缓存：用本地解析 JWT 的
`exp`（带一点时钟偏移容差）判断有没有过期，没过期就直接复用，省去重新登录。但光看 `exp`
还不够——token 可能在服务端被提前作废（比如被顶号），所以 `ensureLogin` 还会拿缓存的 token 去请求一次
`getPersonalInfo`，确认它在服务端确实还有效，无效才重新登录。

`client.ts` 里 `token` 初值是字符串 `'null'` 而非 `null`——抓包确认无 token 时 `Token`
header 就该是字面量 `'null'`，别改成不发 header。

### 接口串联与若干细节

完整的数据来源是四个接口逐级展开：

```
getPersons     账户 → 名下所有被保险人
getPolicies    每个被保险人 → 他/她的各个保单年度
getClaimList   每个（被保险人, 年度）→ 该年度的理赔列表
getClaimDetail 每条理赔 → 完整详情
```

几个抓取时踩过的坑：

- `getClaimList` 的 `status`
  参数支持逗号分隔的多个值。网页 UI 分"处理中/待补件/已完成"三个 tab发三次请求，但其实传
  `"1,2,3,4,5"` 一次就能拿全所有状态。
- **每个保单年度的 `grpPlanCode` 不一样**。查某一年的理赔列表时，必须用那一年对应的
  `grpPlanCode`，不能图省事用固定值，否则查不到。
- EOB（理赔说明书）那张图**不在任何 JSON 字段里**。它在一个固定路径
  `.../EobPath/rider/MshBat/APP/image/${claimNo}.jpg`，按 claimNo 拼出来即可；返回 404 就表示这条理赔没有 EOB，跳过。
- 附件图片是公开 URL，不需要鉴权就能下。但我们仍然把它们下载到本地，以保证最终产物完全离线。

## 产物结构

```
output/
├── index.html              总览：每位被保险人一个可折叠区块，理赔列表表格
├── persons.json            账户下所有人的原始数据
└── claims/
    └── <姓名>/
        ├── policies.json   这个人的各保单年度
        ├── claims.json     这个人的完整理赔列表
        └── <日期>_<理赔号>/
            ├── index.html  渲染好的理赔详情页
            ├── claim.md    同样内容的 Markdown
            ├── detail.json 接口返回的原始数据
            └── images/     所有附件 + EOB，已下载到本地
```

整个站点是相对路径、图片本地化的，可以离线浏览。

## 代码组织

- `src/http/client.ts` ——
  `fetchWithSign`（给每个请求加签名 header）、可变的 token（`setToken`，登录后更新）、以及
  `negotiateSession`（封装上面的密钥协商）。
- `src/crypto/` —— `sign.ts` 是 HMAC 签名，`cipher.ts` 是 RSA/AES 会话加解密。
- `src/auth/` —— `login.ts`（登录与 token 缓存逻辑）、`token-store.ts`（`.token`
  读写与 JWT 过期判断）、`secret-check.ts`（启动时校验 secret）。
- `src/api/` —— 每个接口一个模块：`persons`、`policies`、`claim-list`、`claim`（详情）。
- `src/download/` —— `claim.ts` 编排单条理赔的下载与落盘，`images.ts` 下图，`render.ts` /
  `index-page.ts` 生成 HTML（通过 `src/templates/` 下的 Eta 模板渲染），`template.ts` 是 Eta 实例。
- `src/index.ts` —— 顶层流程，把上面这些串起来。

## 开发须知

- 运行：`yarn start`（用 tsx 跑，自动加载 `.env`；macOS 下跑完会自动打开产物）。
- **每次改完代码都跑 `npx tsc --noEmit` 做类型检查**——tsx 运行时不做类型检查，只靠它兜底。
- 格式化：`yarn lint`（prettier 写入）/ `yarn lint:check`（校验）。
- 测试时用 `MAX_CLAIMS_PER_PERSON=N` 限制每人下载条数，避免一跑就拉几百条。
- 探接口时经常会写一次性脚本（比如
  `dump-test.ts`）打印响应，**摸清楚、把结论折进正式代码后就删掉**，不要留在仓库里。
- 理赔和年度的抓取用 bluebird 的 `Promise.map` 做并发，并发数由环境变量 `CONCURRENCY`
  控制（默认 5）。
- HTML 一律走 Eta 模板，不要把标记字符串塞进
  `.ts`；模板里尽量不写 JS（总览页为了"整行可点击" 用了内联 `onclick`，这是唯一的例外）。
- 日志统一用 `src/log.ts` 里的 `step` / `info` / `item` / `done` / `warn`，保证输出有层次、整洁。
- 协议随时可能因为对方改版而失效。真出问题时，重新下载
  `https://wechat.mshasia.com/wechat/static/js/app.<hash>.js`（hash 每次部署都变，入口 HTML 里有当前文件名），beautify 之后重新追踪加密模块——它是 webpack 模块
  `313f`，经 `e51b` 重导出。
