# msh-china-downloader

[English](./README.md) | [中文](./README.zh-CN.md)

MSH
China 保险理赔下载器，基于微信端 H5（<https://wechat.mshasia.com/wechat/>）背后的接口原理实现。用你的账号登录后，遍历账户下每个被保险人、每个保单年度，把**全部**理赔（文字详情 + 附件图片）保存成一个完全离线、可浏览的站点。

> **⚠️ 由 AI 辅助编写，请谨慎使用。**
> 本项目完全通过 AI 辅助的"氛围编程"构建，未经审计。实现中可能存在难以察觉的 bug 或从未被考虑到的边界情况。请仔细审查，风险自负。

> **⚠️ 逆向工程实现，无官方接口。**
> MSH 并不存在公开接口；整套协议是从微信端 H5 前端 bundle 里逆向出来的。它未经官方文档支持、与 MSH 官方无任何关联，对方一旦改版随时可能失效，理论上也可能违反其服务条款。请仅用于你自己的账号、抓取你自己的数据、做个人存档之用——不要用于任何商业或大规模用途。使用本工具的一切后果由你自行承担。

## 演示

https://github.com/user-attachments/assets/a711ed49-a1df-4b3f-b790-ec2a04e697d8

> 演示中的姓名、理赔号、医院、金额及附件图片均已脱敏处理。

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

## 产物结构

所有内容都会写入 `output/` 目录。用任意浏览器打开 `output/index.html`
即可浏览；macOS 上运行结束后会自动打开。

运行过程大致如下：

```text
$ yarn start

▸ Checking SIGNATURE_SECRET against latest app.js
  ✓ SIGNATURE_SECRET is up to date

▸ Logging in
  ✓ Logged in — 3 insured person(s) found

▸ [1/3] Zhang, San 张三 (本人)
  Policy years: 2026, 2025, 2024
    · 2026: 4 claim(s)
    · 2025: 3 claim(s)
    · 2024: 1 claim(s)
  8 unique claim(s), downloading 8 (concurrency 10)
    · [1/8] DB71***36 (处理中)
    · [2/8] DB05***82 (处理中)
    · [3/8] NDB47***12 (已结案)
    · ...
    · [8/8] NDB80***54 (已结案)

▸ [2/3] Li, Si 李四 (配偶)
  Policy years: 2026, 2025, 2024
    · 2026: 3 claim(s)
    · 2025: 3 claim(s)
    · 2024: 2 claim(s)
  8 unique claim(s), downloading 8 (concurrency 10)
    · [1/8] NDB36***49 (处理中)
    · [2/8] NDB72***05 (处理中)
    · [3/8] DB61***27 (处理中)
    · ...
    · [8/8] DB83***19 (已结案)

▸ [3/3] Wang, Wu 王五 (子女)
  Policy years: 2026
    · 2026: 2 claim(s)
  2 unique claim(s), downloading 2 (concurrency 10)
    · [1/2] NDB65***74 (处理中)
    · [2/2] NDB90***21 (处理中)

▸ Writing index.html
  ✓ Opening /path/to/output/index.html
```

产物的目录结构：

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

## 说明

- 登录 token 会缓存在 `.token`，未过期时复用。
- 启动时会检查 `SIGNATURE_SECRET` 是否仍与线上站点一致，若已变化会警告（但不中断运行）。
