# Structured Logging Specification

## Purpose

This specification defines structured logging behavior for the remision-manager-backend project. The system SHALL emit all log output as structured JSON, replacing prior unstructured console and HTTP-access logging. Every log line MUST carry contextual fields — including a request identifier and an authenticated user identifier when applicable — so that logs are filterable, parseable, and correlate-able in production. Log level SHALL be configurable via environment variable. HTTP request logging SHALL be suppressed in the test environment. Development environments MAY use human-readable pretty-printing without breaking the structured guarantee.

## Requirements

### Requirement: JSON-Structured Log Output

The system MUST emit every log message as a JSON object. The JSON object SHALL contain at minimum a `level`, a `msg` (or `message`), and a `time` field. The system MUST NOT emit plain text or ad-hoc formatted strings as log output in production.

#### Scenario: Application start-up logs are structured JSON

- GIVEN the application is starting in a non-development environment
- WHEN a log line is emitted (for example, a database-connection log)
- THEN the output is a single parseable JSON object
- AND the object contains `level`, `msg`, and `time` fields

#### Scenario: Error logs are structured JSON

- GIVEN an unhandled error occurs during request processing in a non-development environment
- WHEN the error is logged
- THEN the output is a single parseable JSON object
- AND the object contains `level` equal to `"error"` and a `msg` field describing the error

#### Scenario: Log output is machine-parseable

- GIVEN a running application in a non-development environment
- WHEN log output is collected by a log aggregator
- THEN each line is independently valid JSON
- AND no line requires regex parsing to extract the level or message

### Requirement: Request ID Attachment

Every log line emitted during the processing of an HTTP request MUST include a `requestId` field. The system SHALL derive the request identifier from the incoming `X-Request-Id` header when present; otherwise it SHALL generate a new UUID for the request. The same identifier MUST appear in every log line for that request and MUST be included in the HTTP response via an `X-Request-Id` header.

#### Scenario: Request with X-Request-Id header uses the provided ID

- GIVEN an incoming HTTP request with header `X-Request-Id: abc-123`
- WHEN any log line is emitted during request processing
- THEN the log line contains `"requestId":"abc-123"`
- AND the HTTP response contains header `X-Request-Id: abc-123`

#### Scenario: Request without X-Request-Id header receives a generated ID

- GIVEN an incoming HTTP request with no `X-Request-Id` header
- WHEN any log line is emitted during request processing
- THEN the log line contains a `requestId` field with a non-empty UUID value
- AND the HTTP response contains an `X-Request-Id` header matching that value

#### Scenario: Multiple log lines for the same request share the same requestId

- GIVEN a single HTTP request that triggers at least two log lines (for example, an access log and an error log)
- WHEN the logs are emitted
- THEN both log lines contain the identical `requestId` value

### Requirement: Authenticated User ID Attachment

Every log line emitted during the processing of an authenticated HTTP request MUST include a `userId` field containing the identifier of the authenticated user. Unauthenticated requests MUST NOT include a `userId` field, or MUST include it with a null or absent value.

#### Scenario: Authenticated request logs carry userId

- GIVEN an HTTP request with a valid bearer token belonging to user `user-42`
- WHEN any log line is emitted during request processing
- THEN the log line contains `"userId":"user-42"`

#### Scenario: Unauthenticated request omits userId

- GIVEN an HTTP request to a public endpoint with no authentication token
- WHEN any log line is emitted during request processing
- THEN the log line either does not contain a `userId` field or contains `"userId":null`

### Requirement: Configurable Log Level

The system MUST read the desired minimum log level from the `LOG_LEVEL` environment variable. Valid values SHALL be `trace`, `debug`, `info`, `warn`, `error`, and `fatal`. When `LOG_LEVEL` is unset, the system SHALL default to `info`. Log messages whose level is below the configured minimum MUST NOT be emitted.

#### Scenario: LOG_LEVEL filters out debug messages

- GIVEN `LOG_LEVEL` is set to `info`
- WHEN the application emits a log at level `debug`
- THEN the log message is not written to output

#### Scenario: LOG_LEVEL allows error messages

- GIVEN `LOG_LEVEL` is set to `warn`
- WHEN the application emits a log at level `error`
- THEN the log message is written to output

#### Scenario: Default log level is info

- GIVEN `LOG_LEVEL` is unset
- WHEN the application starts
- THEN the effective minimum log level is `info`
- AND an `info`-level start-up log is emitted

### Requirement: HTTP Log Suppression in Test Environment

The system MUST NOT emit HTTP request/response logs when `NODE_ENV` (or the environment indicator used by the application) equals `test`. This suppression SHALL apply regardless of the configured `LOG_LEVEL`.

#### Scenario: Tests run silently with respect to HTTP logs

- GIVEN the application is running in the `test` environment
- WHEN an HTTP request is processed through the application
- THEN no HTTP access log line is written to standard output or standard error

#### Scenario: Non-test environment continues to log HTTP requests

- GIVEN the application is running in the `development` or `production` environment
- WHEN an HTTP request is processed through the application
- THEN at least one structured log line representing the request is emitted

### Requirement: Development Pretty-Printing

The system MAY pretty-print log output in the `development` environment. Pretty-printing SHALL NOT violate the structured-logging contract: the output MUST remain a sequence of valid JSON objects, optionally with whitespace and colorization for human readability.

#### Scenario: Development logs are human-readable

- GIVEN the application is running in the `development` environment
- WHEN a log line is emitted
- THEN the output MAY contain newlines, indentation, or ANSI color codes
- AND the output MUST still be parseable as valid JSON after stripping ANSI codes and collapsing whitespace
