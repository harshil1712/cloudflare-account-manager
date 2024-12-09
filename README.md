# Cloudflare Account Manager

Manage members and resources for your Cloudflare account.

## Endpoints

1. GET `/api/bucket/list`: List all R2 buckets
2. DELETE `/api/bucket/object`: Delete objects from the buckets
3. DELETE `/api/bucket`: Delete all the buckets
4. GET `/api/queue`: Get all the Queues
5. DELETE `/api/queue`: Delete all the Queues
6. GET `/api/worker`: Get all the workers
7. DELETE `/api/worker`: Delete all the workers
8. GET `/api/member`: Get all the members
9. DELETE `/api/member`: Delete all the members. If you don't want to delete certain members, pass the JSON body as `{emails: ["email1_of@member", "email2_of@member]}`. The accounts associated with these emails will not be removed

## Setup

### Create an Account Token

> You need to have `Super Administrator - All Privileges` role

- Navigate to the account, you want to manage
- Go to Manage Account > Account API Tokens > Create Token

Create a token with the following scopes:
- Account Settings - Edit
- Workers Scripts - Edit
- Cloudflare Pages - Edit

For R2, you will also need the S3 credentials.


## Usage

```sh
npm install
npm run dev
```
