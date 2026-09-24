# Testing Infrastructure Specification

## Purpose

This specification defines the testing infrastructure, conventions, and initial unit test requirements for the remision-manager-backend project. It establishes Bun's built-in test runner as the project's testing framework, defines test file naming and placement conventions, and specifies the initial unit test suites for pure domain logic, DTO validation, and error hierarchy classification.

## Requirements

### Requirement: Test Runner Availability

The system MUST provide a functional test runner executable from the project root. `bun test` SHALL be the primary test command, invoked with zero exit code on success and non-zero exit code on failure.

#### Scenario: Test runner executes successfully with passing tests

- GIVEN the project has at least one passing test file
- WHEN `bun test` is executed from the project root
- THEN the command exits with status code 0
- AND the output reports the number of passing tests

#### Scenario: Test runner fails with failing tests

- GIVEN the project has at least one failing test (assertion failure)
- WHEN `bun test` is executed from the project root
- THEN the command exits with a non-zero status code
- AND the output identifies the failing test file and assertion

#### Scenario: Test runner fails when no tests exist

- GIVEN the project has zero test files matching the convention
- WHEN `bun test` is executed from the project root
- THEN the command exits with a non-zero status code OR reports zero tests found
- AND does not falsely report success

#### Scenario: Watch mode is available for interactive development

- GIVEN a `test:watch` script exists in `package.json`
- WHEN `bun run test:watch` is executed from the project root
- THEN the test runner starts in watch mode and re-runs tests on file changes

### Requirement: Test File Naming Convention

The system SHALL enforce a consistent test file naming and placement convention so that the test runner discovers all test files automatically.

#### Scenario: Co-located test files are discovered

- GIVEN a source file exists at `src/domain/entities/Remision.ts`
- WHEN a test file named `Remision.test.ts` is placed in the same directory
- THEN `bun test` discovers and executes the test file

#### Scenario: Non-conforming test files are ignored

- GIVEN a file named `Remision.spec.ts` exists in `src/domain/entities/`
- WHEN `bun test` is executed from the project root
- THEN the `.spec.ts` file is NOT executed by the test runner (unless explicitly configured)

#### Scenario: Test files use relative imports matching project convention

- GIVEN a test file in `src/domain/entities/` imports from `src/shared/errors/`
- WHEN the test file is written
- THEN it uses relative import paths (not `@/*` aliases) to match the current codebase convention

### Requirement: Remision Total Computation Unit Tests

The system MUST include unit tests that verify the correctness of `Remision` entity total computation logic (`computeTotals`), covering happy paths and edge cases.

#### Scenario: Total computation with priced items

- GIVEN a `Remision` entity with line items that have `type: "priced"`, each with a `quantity` and `unitPrice`
- WHEN `computeTotals` is called on the entity
- THEN `subtotal` equals the sum of `quantity * unitPrice` for all priced items
- AND `total` equals `subtotal` plus applicable taxes
- AND items with `type: "quantity_only"` are excluded from the monetary calculation

#### Scenario: Total computation with empty items

- GIVEN a `Remision` entity with an empty items array
- WHEN `computeTotals` is called on the entity
- THEN `subtotal` equals 0
- AND `total` equals 0 (or the minimum base value defined by business rules)

#### Scenario: Total computation with mixed item types

- GIVEN a `Remision` entity with a mix of `type: "priced"` and `type: "quantity_only"` items
- WHEN `computeTotals` is called on the entity
- THEN only `priced` items contribute to `subtotal` and `total`
- AND `quantity_only` items are counted for quantity tracking but NOT for monetary totals

#### Scenario: Total computation rejects invalid negative prices

- GIVEN a `Remision` entity with a line item that has a negative `unitPrice`
- WHEN `computeTotals` is called on the entity
- THEN the system EITHER excludes the invalid item from the total OR throws a validation error
- AND does NOT produce a negative subtotal from invalid input

### Requirement: Zod DTO Validation Unit Tests

The system MUST include unit tests that verify Zod DTO validation schemas accept valid input and reject invalid input for representative DTOs from each layer (auth, remision).

#### Scenario: Auth DTO accepts valid registration input

- GIVEN a valid registration DTO with all required fields: `email` (valid format), `password` (meets minimum length), `name` (non-empty string)
- WHEN the Zod schema's `safeParse` method is called with this input
- THEN `safeParse` returns `{ success: true }`
- AND the parsed data matches the expected output shape

#### Scenario: Auth DTO rejects invalid email format

- GIVEN an input DTO with `email` set to `"not-an-email"` and other fields valid
- WHEN the Zod schema's `safeParse` method is called with this input
- THEN `safeParse` returns `{ success: false }`
- AND the `error` object contains a validation message for the `email` field

#### Scenario: Remision DTO accepts valid creation input

- GIVEN a valid remision creation DTO with all required fields populated with valid types
- WHEN the Zod schema's `safeParse` method is called with this input
- THEN `safeParse` returns `{ success: true }`
- AND all fields are coerced/validated to their expected types

#### Scenario: Remision DTO rejects missing required fields

- GIVEN an input DTO with one or more required fields omitted
- WHEN the Zod schema's `safeParse` method is called with this input
- THEN `safeParse` returns `{ success: false }`
- AND the `error` object identifies each missing required field

#### Scenario: DTO rejects values that violate constraints

- GIVEN an input DTO with a field value that violates a schema constraint (e.g., `quantity` is negative, `email` exceeds max length, enum value is not in allowed set)
- WHEN the Zod schema's `safeParse` method is called with this input
- THEN `safeParse` returns `{ success: false }`
- AND the `error` object identifies the constraint violation

### Requirement: AppError Hierarchy Unit Tests

The system MUST include unit tests that verify the `AppError` class hierarchy correctly supports instanceof classification, the `isOperational` flag, and HTTP status code assignment.

#### Scenario: AppError instance is recognized by instanceof

- GIVEN an error instance created as `new AppError("message", 500)`
- WHEN the `instanceof` operator is used to check against `AppError`
- THEN the check returns `true`
- AND the error's `message` property equals `"message"`
- AND the error's `statusCode` property equals `500`

#### Scenario: Operational errors are flagged correctly

- GIVEN an `AppError` instance created with `isOperational: true` (or via the operational factory method)
- WHEN the `isOperational` property is accessed
- THEN it returns `true`
- AND the error is classified as a known, expected failure (not a programmer bug)

#### Scenario: Non-operational errors are flagged correctly

- GIVEN an `AppError` instance created with `isOperational: false` (or without the operational flag)
- WHEN the `isOperational` property is accessed
- THEN it returns `false`
- AND the error is classified as an unexpected, internal failure

#### Scenario: AppError assigns correct HTTP status codes

- GIVEN `AppError` subclasses or factory methods for specific error types (e.g., `NotFoundError`, `ValidationError`, `UnauthorizedError`)
- WHEN an instance of each subclass is created
- THEN each instance carries the correct HTTP status code (e.g., 404, 400, 401 respectively)
- AND `instanceof AppError` returns `true` for all subclasses

#### Scenario: Native Error is NOT an AppError

- GIVEN a standard JavaScript `Error` instance (not created via `AppError` or its subclasses)
- WHEN the `instanceof` operator is used to check against `AppError`
- THEN the check returns `false`

### Requirement: OpenSpec Testing Metadata

The system MUST reflect the testing configuration in `openspec/config.yaml` so that downstream SDD phases and tooling recognize the project as test-capable.

#### Scenario: Config declares Bun as the test runner

- GIVEN `openspec/config.yaml` is read
- WHEN the `testing.runner` field is inspected
- THEN it equals `"bun"`

#### Scenario: Config declares the test command

- GIVEN `openspec/config.yaml` is read
- WHEN the `testing.test_command` field is inspected
- THEN it equals `"bun test"`

#### Scenario: Config enables unit testing flag

- GIVEN `openspec/config.yaml` is read
- WHEN the `testing.projects[0].test_layers.unit` field is inspected
- THEN it equals `true`

#### Scenario: Config enables integration testing flag

- GIVEN `openspec/config.yaml` is read
- WHEN the `testing.projects[0].test_layers.integration` field is inspected
- THEN it equals `true`

#### Scenario: package.json includes test scripts

- GIVEN `package.json` is read
- WHEN the `scripts` field is inspected
- THEN it contains a `"test"` script that invokes `bun test`
- AND it contains a `"test:watch"` script that invokes `bun test` in watch mode

(Previously: integration testing was not declared in OpenSpec metadata; the project only declared unit test capability.)
### Requirement: Integration Test Database Lifecycle

The system MUST provide an in-memory MongoDB instance for integration tests that starts before the test suite, connects via Mongoose, and shuts down after all tests complete.

#### Scenario: In-memory database starts and connects

- GIVEN integration tests are executed
- WHEN the test suite begins
- THEN an in-memory MongoDB instance starts successfully
- AND Mongoose connects to it without error
- AND the connection URI is NOT the production `MONGO_URI`

#### Scenario: Database disconnects and stops after tests

- GIVEN integration tests have completed execution
- WHEN the test suite teardown runs
- THEN Mongoose disconnects from the in-memory database
- AND the in-memory MongoDB instance stops

#### Scenario: Each test receives a clean database state

- GIVEN a previous integration test created documents in the database
- WHEN the next integration test begins
- THEN the relevant collections are empty OR reset to a known baseline
- AND no document state from the previous test leaks into the current test

### Requirement: HTTP Test Harness and Request Helpers

The system MUST provide an HTTP-level test harness capable of sending requests to the Express application without binding to a live network port, together with helpers for constructing authenticated request headers and for cleaning up database state between tests.

#### Scenario: HTTP requests reach the application without a network port

- GIVEN the Express application is created via `createServer()`
- WHEN an HTTP request is issued through the test harness
- THEN the request reaches the application's routing and middleware layers
- AND the response status code and body are observable by the test

#### Scenario: Helper generates valid Bearer token headers

- GIVEN a helper that creates a valid JWT access token for a test user with a known `id` and `role`
- WHEN an authenticated request is constructed using the helper
- THEN the request includes an `Authorization` header with value `Bearer <token>`
- AND the `authenticate` middleware accepts the token and attaches the user to the request

#### Scenario: Database cleanup helper removes documents between tests

- GIVEN a database cleanup helper
- WHEN it is invoked between integration tests
- THEN all documents in the target collections are removed
- AND collection indexes and schemas remain intact

### Requirement: Middleware Integration Tests

The system MUST include integration tests for the core HTTP middleware layer that verify behavior at the boundary between HTTP requests and application logic.

#### Scenario: Authenticate middleware rejects missing tokens

- GIVEN a request to a protected endpoint with no `Authorization` header
- WHEN the request is processed by the application
- THEN the response status is `401`
- AND the response body indicates an authentication failure

#### Scenario: Authenticate middleware rejects invalid tokens

- GIVEN a request with an `Authorization` header containing a malformed or expired JWT
- WHEN the request is processed by the application
- THEN the response status is `401`
- AND the response body indicates the token is invalid or expired

#### Scenario: Authorize middleware rejects insufficient roles

- GIVEN an authenticated request with a user whose role is `"user"`
- WHEN the request targets an endpoint restricted to `"admin"`
- THEN the response status is `403`
- AND the response body indicates an authorization failure

#### Scenario: Error handler returns structured errors for AppError

- GIVEN a route that throws an `AppError` subclass (e.g., `NotFoundError`)
- WHEN the request is processed by the application
- THEN the response status matches the error's `statusCode`
- AND the response body contains `success: false` and the error message

#### Scenario: Rate limiter blocks excessive requests

- GIVEN the general rate limiter is applied to an endpoint
- WHEN more requests than the configured limit are sent from the same client within the time window
- THEN subsequent requests receive a `429` response
- AND the response body indicates too many requests

### Requirement: End-to-End Request Lifecycle Test

The system MUST include at least one integration test that exercises a full request lifecycle spanning multiple endpoints with stateful dependencies.

#### Scenario: Register, login, and access a protected endpoint

- GIVEN a clean in-memory database
- WHEN a user submits valid registration data to the registration endpoint
- AND submits valid credentials to the login endpoint
- AND uses the access token from the login response to request a protected endpoint
- THEN the protected endpoint responds with status `200`
- AND the response reflects the authenticated user's identity or data

