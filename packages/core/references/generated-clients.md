---
description: Clients generated from routes
order: 230
---

# Generated clients

`clients` reads the app module or the document and writes clients that know the routes:

```sh
npx --package @workerstack/clients clients generate --app src/app.ts --target ts --target python --out generated
```

A call answers your value and throws a typed error by status; its `client.safe` mirror answers the same calls as a
`Result` instead, so a failure is a value rather than a throw. All six SDKs have both styles.

```ts sdk
import { DecodeError, Kitchen, NotFoundError } from "./kitchen"

export function newClient(): Kitchen {
	return new Kitchen({
		baseURL: "https://api.example.com",
		headers: { authorization: `Bearer ${process.env.KITCHEN_TOKEN ?? ""}` },
		timeout: 10_000,
	})
}

export async function organization(client: Kitchen, orgId: string): Promise<string | null> {
	try {
		await client.organizations.retrieve({ params: { orgId } })
		return orgId
	} catch (error) {
		if (error instanceof NotFoundError) return null
		throw error
	}
}

export async function health(client: Kitchen): Promise<string> {
	const result = await client.safe.health.check()
	if (result.ok) return "up"
	if (result.error instanceof DecodeError) return `unreadable answer: ${result.error.message}`
	return `answered ${result.error.status}`
}
```

That block is a slice of
[the compiled example](https://github.com/workerstack/clients/blob/main/docs/examples/ts/example.ts), which the generator's own tests
type-check against an SDK generated from a real document.

Full reference: [code generation](https://github.com/workerstack/clients/blob/main/docs/codegen.md),
[the generated clients](https://github.com/workerstack/clients/blob/main/docs/client.md),
[their per-language recipes](https://github.com/workerstack/clients/blob/main/docs/sdk-recipes.md),
[the generated CLI](https://github.com/workerstack/clients/blob/main/docs/cli.md) and
[releasing it](https://github.com/workerstack/clients/blob/main/docs/cli-release.md).
