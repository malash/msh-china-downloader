# msh-china-downloader

[English](./README.md) | [中文](./README.zh-CN.md)

A downloader for MSH China insurance claims, built on the APIs behind the WeChat H5 app at
<https://wechat.mshasia.com/wechat/>. It logs in with your account, walks every insured person and
policy year, and saves **all** claims — text details and attachment images — as a self-contained,
offline-browsable site.

> **⚠️ Vibe coded — use with caution.**
> This project was built entirely through AI-assisted vibe coding and has not been audited. The implementation may contain subtle bugs or edge cases that were never considered. Review carefully and use at your own risk.

> **⚠️ Reverse-engineered — no official API.**
> There is no public MSH API; the entire protocol was reverse-engineered from the WeChat H5 front-end bundle. It is undocumented and unaffiliated with MSH, may break at any time if they change their site, and could in theory violate their terms of service. Use only with your own account and your own data, for personal archiving — not for any commercial or large-scale purpose. You bear all responsibility for how you use it.

## Demo

https://github.com/user-attachments/assets/a711ed49-a1df-4b3f-b790-ec2a04e697d8

> All names, claim numbers, hospitals, amounts, and attachment images in the demo have been
> anonymized.

## Usage

1. Install dependencies:

   ```sh
   yarn install
   ```

2. Create `.env` from the example and fill in your credentials:

   ```sh
   cp .env.example .env
   ```

   | Variable                | Required | Description                                                      |
   | ----------------------- | -------- | ---------------------------------------------------------------- |
   | `USERNAME` / `PASSWORD` | yes      | Your MSH login                                                   |
   | `SIGNATURE_SECRET`      | yes      | Request-signing secret (a working value ships in `.env.example`) |
   | `CONCURRENCY`           | no       | Parallel downloads (default 5)                                   |
   | `MAX_CLAIMS_PER_PERSON` | no       | Cap per person, for testing (default: no limit)                  |

3. Run:

   ```sh
   yarn start
   ```

   On macOS the overview page opens automatically when done.

## What you get

```
output/
├── index.html              # overview: one collapsible section per person, claim table
├── persons.json            # raw account data
└── claims/
    └── <name>/
        ├── policies.json   # this person's policy years
        ├── claims.json     # this person's full claim list
        └── <date>_<claimNo>/
            ├── index.html  # the claim, rendered for reading
            ├── claim.md    # same content in Markdown
            ├── detail.json # raw API response
            └── images/     # all attachments + EOB, downloaded locally
```

Everything is offline: images are saved locally and all links are relative.

## Notes

- The auth token is cached in `.token` and reused until it expires.
- On startup the tool checks whether `SIGNATURE_SECRET` still matches the live site and warns
  (without stopping) if it has changed.
