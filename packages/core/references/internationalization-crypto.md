---
description: Translations and crypto
order: 200
---

# Internationalization and crypto

Error messages translate through a dictionary you supply, and ICU messages interpolate with plurals:

```ts run
import { interpolate } from "@workerstack/backend/http/i18n"

const message = "{count, plural, one {# new message} other {# new messages}} for {name}"
console.log(interpolate(message, { count: 3, name: "Ada" }, "en"))
// prints: 3 new messages for Ada
```

```ts
import { defineErrors, httpApp } from "@workerstack/backend/http"
import { createErrorTranslator, translateError } from "@workerstack/backend/http/i18n"

const errors = defineErrors({ not_found: "not_found" })

/* locale, then error key, then the ICU template that key's message reads from */
const translations = { errors: { de: { not_found: "Nicht gefunden" }, en: { not_found: "Not found" } } }

const app = httpApp().errorI18n(
	createErrorTranslator({
		...translations,
		resolveLocale: (ctx) => ctx.headers["accept-language"]?.slice(0, 2) ?? "en",
	}),
)

app.get("/books/:id").handler((ctx) => ctx.res.json("ok", { id: ctx.params.id }))

const german = translateError(errors.not_found(), translations, "de")
```

Crypto is WebCrypto, with the comparison that does not leak by timing. It resolves a boolean, so await it:

```ts run
import { timingSafeEqual } from "@workerstack/backend/crypto"

const expected = "s3cret-token"
if (await timingSafeEqual("s3cret-token", expected)) console.log("token accepted")
if (!(await timingSafeEqual("guess", expected))) console.log("guess refused")
// prints: token accepted
// prints: guess refused
```

Full reference: [internationalization](https://github.com/workerstack/backend/blob/main/docs/i18n.md),
[crypto](https://github.com/workerstack/backend/blob/main/docs/crypto.md),
[JWT](https://github.com/workerstack/backend/blob/main/docs/jwt.md),
[user agent](https://github.com/workerstack/backend/blob/main/docs/user-agent.md),
[cron](https://github.com/workerstack/backend/blob/main/docs/cron.md) and
[queue](https://github.com/workerstack/backend/blob/main/docs/queue.md).
