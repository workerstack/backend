import { describe, expect, it } from "vitest"
import { EK, type FieldError, HttpError, isFrameworkErrorKey } from "./error.ts"

describe("HttpError", () => {
	// v0: f022ad7dc1
	it("constructs with correct status code from StatusKey", () => {
		const err = new HttpError({ errorKey: "test", status: "conflict" })
		expect(err.status).toBe(409)
		expect(err.statusKey).toBe("conflict")
		expect(err.errorKey).toBe("test")
	})

	// v0: e66b18c73c
	it("is instanceof Error", () => {
		const err = new HttpError({ errorKey: "test", status: "bad_request" })
		expect(err).toBeInstanceOf(Error)
		expect(err).toBeInstanceOf(HttpError)
	})

	// v0: 3656c1dc0b
	it("stack trace contains errorKey", () => {
		expect(new HttpError({ errorKey: "my_custom_error", status: "bad_request" }).stack).toContain("my_custom_error")
	})

	// v0: 85eaf4b513
	// v0: 1d261c36cc
	it("cause on native Error.cause", () => {
		const cause = new Error("db failed")
		expect(new HttpError({ cause, errorKey: "test", status: "bad_request" }).cause).toBe(cause)
		expect(Object.hasOwn(new HttpError({ errorKey: "test", status: "bad_request" }), "cause")).toBe(false)
	})

	// v0: 93e6aebf93
	it("fields defaults to {} when not provided", () => {
		const err = new HttpError({ errorKey: "test", status: "bad_request" })
		expect(err.fields).toEqual({})
		expect(Object.isFrozen(err.fields)).toBe(true)
	})

	// v0: f92ac812e4
	it("vars is undefined when not provided", () => {
		expect(new HttpError({ errorKey: "test", status: "bad_request" }).vars).toBeUndefined()
	})
})

describe("HttpError options", () => {
	// v0: 6e65b2123b
	it("accepts fields", () => {
		const fields: Record<string, FieldError[]> = {
			email: [{ error_key: "field_invalid_email", message: "bad email", path: "json.email" }],
		}
		expect(new HttpError({ errorKey: "test", fields, status: "bad_request" }).fields).toBe(fields)
	})

	// v0: 8f264a5d80
	it("accepts vars", () => {
		const vars = { slug: "my-org" }
		expect(new HttpError({ errorKey: "test", status: "conflict", vars }).vars).toBe(vars)
	})

	// v0: b7bdc3e4a8
	it("message is initially errorKey", () => {
		expect(new HttpError({ errorKey: "org_slug_taken", status: "conflict" }).message).toBe("org_slug_taken")
	})

	// v0: 5f33129599
	it("an unknown status key is a 500, never a 200", () => {
		const err = new HttpError({ errorKey: "x", status: "made_up" as never })
		expect(err.status).toBe(500)
		expect(err.statusKey).toBe("internal_server_error")
		expect(new HttpError({ errorKey: "x", status: "toString" as never }).status).toBe(500)
	})

	it("keeps data and headers", () => {
		const err = new HttpError({
			data: { n: 1 },
			errorKey: "x",
			headers: { "retry-after": "5" },
			status: "too_many_requests",
		})
		expect(err.data).toEqual({ n: 1 })
		expect(err.headers).toEqual({ "retry-after": "5" })
	})
})

describe("HttpError.serialize", () => {
	// v0: dec329e3ef
	it("serializes non-Error values", () => {
		expect(HttpError.serialize("oops")).toEqual({ message: "oops" })
		expect(HttpError.serialize(42)).toEqual({ message: "42" })
		expect(HttpError.serialize(null)).toEqual({ message: "null" })
		expect(HttpError.serialize(undefined)).toEqual({ message: "undefined" })
	})

	// v0: 949a500266
	it("serializes native Error with stack", () => {
		const result = HttpError.serialize(new Error("boom"))
		expect(result.message).toBe("boom")
		expect(result.name).toBe("Error")
		expect(result.stack).toBeTypeOf("string")
		expect(result).not.toHaveProperty("errorKey")
	})

	// v0: 50a1bee40c
	it("serializes HttpError with errorKey, status, statusKey", () => {
		const result = HttpError.serialize(new HttpError({ errorKey: "user_not_found", status: "not_found" }))
		expect(result).toMatchObject({
			errorKey: "user_not_found",
			message: "user_not_found",
			name: "Error",
			status: 404,
			statusKey: "not_found",
		})
		expect(result.stack).toBeTypeOf("string")
		expect(result).not.toHaveProperty("vars")
	})
})

describe("HttpError.serialize: vars, fields and cause", () => {
	// v0: ca208e92c4
	it("includes vars when present for logs", () => {
		const result = HttpError.serialize(
			new HttpError({ errorKey: "slug_taken", status: "conflict", vars: { slug: "acme" } }),
		)
		expect(result).toMatchObject({ errorKey: "slug_taken", status: 409, vars: { slug: "acme" } })
		expect(result).not.toHaveProperty("cause")
	})

	// v0: 08446f99b6
	it("omits empty fields, includes non-empty fields", () => {
		expect(HttpError.serialize(new HttpError({ errorKey: "bad", status: "bad_request" }))).not.toHaveProperty("fields")
		const fields = { email: [{ error_key: "required", message: "required", path: "json.email" }] }
		expect(HttpError.serialize(new HttpError({ errorKey: "bad", fields, status: "bad_request" }))).toHaveProperty(
			"fields",
		)
	})

	// v0: dcf8b97d91
	it("recursively serializes cause chain", () => {
		const root = new Error("root cause")
		const mid = new HttpError({ cause: root, errorKey: "db_error", status: "internal_server_error" })
		const top = new HttpError({ cause: mid, errorKey: "request_failed", status: "internal_server_error" })
		const result = HttpError.serialize(top)
		expect(result.errorKey).toBe("request_failed")
		const midSerialized = result.cause as Record<string, unknown>
		expect(midSerialized.errorKey).toBe("db_error")
		const rootSerialized = midSerialized.cause as Record<string, unknown>
		expect(rootSerialized.message).toBe("root cause")
		expect(rootSerialized).not.toHaveProperty("cause")
	})

	it("leaves out a falsy cause, as v0 does", () => {
		expect(
			HttpError.serialize(new HttpError({ cause: null, errorKey: "x", status: "bad_request" })),
		).not.toHaveProperty("cause")
	})

	// v0: 3531245a59
	it("handles non-Error cause values", () => {
		const result = HttpError.serialize(
			new HttpError({ cause: "string cause", errorKey: "fail", status: "internal_server_error" }),
		)
		expect((result.cause as Record<string, unknown>).message).toBe("string cause")
	})
})

describe("HttpError.data", () => {
	// v0: 78e6b6cbfc
	it("data is undefined when not provided", () => {
		const err = new HttpError({ errorKey: "test", status: "bad_request" })
		expect(err.data).toBeUndefined()
	})

	// v0: 7b8597247f
	it("data is set when provided", () => {
		const data = { reason: "not found", suggestions: [] }
		expect(new HttpError({ data, errorKey: "item_not_found", status: "not_found" }).data).toBe(data)
	})
})

describe("HttpError.data: edge cases", () => {
	// v0: fa461ef39e
	it("data: undefined means standard error (no data)", () => {
		const err = new HttpError({ errorKey: "x", status: "bad_request" })
		expect(err.data).toBeUndefined()
		expect("data" in err).toBe(true)
	})

	// v0: d837cd74ae
	it("data: explicit value preserved exactly", () => {
		const arr = [1, 2, 3]
		expect(new HttpError({ data: arr, errorKey: "x", status: "bad_request" }).data).toBe(arr)
	})

	// v0: 829daec36d
	it("data: string payload", () => {
		expect(new HttpError({ data: "plain text", errorKey: "x", status: "bad_request" }).data).toBe("plain text")
	})

	// v0: d10e4af942
	it("data: number payload", () => {
		expect(new HttpError({ data: 42, errorKey: "x", status: "bad_request" }).data).toBe(42)
	})
})

describe("framework error keys", () => {
	it("EK names the keys the framework throws on its own behalf", () => {
		expect(EK.validation_failed).toBe("validation_failed")
		expect(Object.isFrozen(EK)).toBe(true)
	})

	it("every framework key but internal_server_error passes a route's declared-error check", () => {
		for (const key of Object.values(EK)) expect(isFrameworkErrorKey(key)).toBe(key !== "internal_server_error")
		expect(isFrameworkErrorKey("email_taken")).toBe(false)
		expect(isFrameworkErrorKey("toString")).toBe(false)
	})
})
