# Chat app backend

## Table of contents

- [Introduction](#introduction)
- [Setting up](#setting-up)
- [Deploying](#deploying)
- [Documentation](#documentation)

## Introduction

This project is the backend of a chat app, it is still in active development

## Setting up

To set up, set the environmental variables, you can do this by:

```bash
cp .env.example .env
```

If you are deploying to production, make sure to configure the environmental variables!

## Deploying

[First, you need to set up the environmental variables.](#setting-up)

Install dependencies:

```bash
npm ci
```

### Serve locally

Run:

```bash
npm run dev
```

### Deploy to production

First, build the code:

```bash
npm run build
```

To run the built code:

```bash
npm start
```

## Documentation

After starting the server:

- Interactive docs: http://\[server-url\]/docs
- OpenAPI spec: http://\[server-url\]/openapi.json

Note: For security reasons, documentation will only be available in development.

---

This project is licensed under the GNU AGPL v3. See the LICENSE file for details.
