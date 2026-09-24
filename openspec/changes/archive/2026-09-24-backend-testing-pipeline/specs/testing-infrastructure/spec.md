# Delta for Testing Infrastructure

## ADDED Requirements

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

## MODIFIED Requirements

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
