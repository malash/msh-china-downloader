# msh-china-downloader

MSH
China 保险理赔下载器，基于微信端 H5（<https://wechat.mshasia.com/wechat/>）背后的接口原理实现。用你的账号登录后，遍历账户下每个被保险人、每个保单年度，把**全部**理赔（文字详情 + 附件图片）保存成一个完全离线、可浏览的站点。

> **⚠️ Vibe coding 产物，谨慎使用。** 本项目完全由 AI 辅助 vibe
> coding 完成，未经审计。它依赖逆向得到的、未公开的接口，随时可能变化或失效。请自行审查，风险自负。

[English](./README.md)

## 产物结构

```
output/
├── index.html              # 总览：每人一个可折叠区块，理赔列表表格
├── persons.json            # 账户原始数据
└── claims/
    └── <姓名>/
        ├── policies.json   # 这个人的各保单年度
        ├── claims.json     # 这个人的完整理赔列表
        └── <日期>_<理赔号>/
            ├── index.html  # 渲染好的理赔详情页
            ├── claim.md    # 同内容的 Markdown
            ├── detail.json # 原始接口返回
            └── images/     # 所有附件 + 理赔说明书(EOB)，已下载到本地
```

全部离线：图片存本地，所有链接都是相对路径。

## 使用方法

1. 安装依赖：

   ```sh
   yarn install
   ```

2. 基于示例创建 `.env` 并填入账号信息：

   ```sh
   cp .env.example .env
   ```

   | 变量                    | 必填 | 说明                                        |
   | ----------------------- | ---- | ------------------------------------------- |
   | `USERNAME` / `PASSWORD` | 是   | MSH 登录账号密码                            |
   | `SIGNATURE_SECRET`      | 是   | 请求签名密钥（`.env.example` 里已附可用值） |
   | `CONCURRENCY`           | 否   | 并发下载数（默认 5）                        |
   | `MAX_CLAIMS_PER_PERSON` | 否   | 每人下载上限，测试用（默认不限）            |

3. 运行：

   ```sh
   yarn start
   ```

   macOS 上下载完成后会自动打开总览页。

## 说明

- 登录 token 会缓存在 `.token`，未过期时复用。
- 启动时会检查 `SIGNATURE_SECRET` 是否仍与线上站点一致，若已变化会警告（但不中断运行）。
