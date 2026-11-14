/**
 * `@workerstack/backend/telemetry`: `otelAdapter` and the types of the value `app.telemetry()` carries.
 * A plain subpath for tree-shaking: backend imports no OpenTelemetry package.
 */
export { type OtelAdapterOptions, type OtelApi, otelAdapter } from "./otel.ts"
export type {
	OtelAttributes,
	AttributeValue,
	OtelSpan,
	SpanOptions,
	OtelTelemetry,
	TelemetryErrorReport,
	OtelTracer,
} from "./request-trace.ts"
export type { RemoteContext } from "./traceparent.ts"
