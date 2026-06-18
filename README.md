# msh-china-downloader

A downloader for MSH China insurance claims, built on the APIs behind the WeChat H5 app at
<https://wechat.mshasia.com/wechat/>. It logs in with your account, walks every insured person and
policy year, and saves **all** claims — text details and attachment images — as a self-contained,
offline-browsable site.

> **⚠️ Vibe coded — use with caution.** This project was built entirely through AI-assisted vibe
> coding and has not been audited. It relies on reverse-engineered, undocumented APIs that may
> change or break at any time. Review carefully and use at your own risk.

[中文文档](./README.zh-CN.md)

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

## Notes

- The auth token is cached in `.token` and reused until it expires.
- On startup the tool checks whether `SIGNATURE_SECRET` still matches the live site and warns
  (without stopping) if it has changed.
