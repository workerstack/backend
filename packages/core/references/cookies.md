---
description: Reading and setting cookies
order: 120
---

# Cookies

`ctx.cookies` reads them, and a response sets them. A signed cookie has a signer you build from its name and your
secrets, newest first, so a rotation keeps the old ones verifying and a value signed for one cookie never passes as
another:

```ts
import { httpApp } from "@workerstack/backend/http"
import { createCookieSigner } from "@workerstack/backend/http/cookie-sign"

const signer = createCookieSigner({ name: "session", secrets: [process.env.COOKIE_SECRET ?? ""] })

const app = httpApp()

app.post("/login").handler(async (ctx) => {
	const session = await signer.sign("user-1")
	const cookie = { value: session, httpOnly: true, secure: true, sameSite: "lax" as const, path: "/" }
	return ctx.res.json("ok", { signedIn: true }, { cookies: { session: cookie } })
})

app.get("/me").handler(async (ctx) => {
	const raw = ctx.cookies.session
	const user = raw === undefined ? null : await signer.verify(raw)
	return ctx.res.json("ok", { user })
})
```

`@workerstack/backend/http/cookie` has the header functions on their own (`serializeCookie`, `parseCookieHeader`):

```ts
import { parseCookieHeader, serializeCookie } from "@workerstack/backend/http/cookie"

declare const req: Request

const jar = parseCookieHeader(req.headers.get("cookie") ?? "")
const header = serializeCookie("theme", { value: "dark", httpOnly: true, path: "/", sameSite: "lax" })
```

Full reference: [cookies](https://github.com/workerstack/backend/blob/main/docs/cookies.md).
