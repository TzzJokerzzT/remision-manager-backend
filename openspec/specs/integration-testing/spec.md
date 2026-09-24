# Integration Testing Specification

## Purpose

This specification defines the integration testing layer for the remision-manager-backend project. It establishes the in-memory database infrastructure, HTTP-level test harness, request helpers, and middleware integration tests required to verify behavior at the boundary between HTTP requests and application logic. It also mandates at least one end-to-end-style test exercising a multi-step request lifecycle.

## Requirements

### Requirement: In-Memory MongoDB Test Database

The system MUST provide an in-memory MongoDB instance for integration tests. The instance SHALL start before the integration test suite begins, SHALL be reachable by Mongoose during tests, and SHALL shut down cleanly after all integration tests complete. Integration tests MUST NOT connect to the production or development MongoDB instance.

#### Scenario: In-memory database starts and connects before tests

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
- AND no mongod processes are left behind

#### Scenario: Each test receives a clean database state

- GIVEN a previous integration test created documents in the database
- WHEN the next integration test begins
- THEN the relevant collections are empty OR reset to a known baseline
- AND no document state from the previous test leaks into the current test

### Requirement: HTTP Test Harness

The system MUST provide an HTTP-level test harness capable of sending requests to the Express application without binding to a live network port. The harness SHALL support all standard HTTP methods and SHALL expose the response status, headers, and body for assertions.

#### Scenario: Requests reach the Express application without a network port

- GIVEN the Express application is created via `createServer()`
- WHEN an HTTP request is issued through the test harness
- THEN the request reaches the application's routing and middleware layers
- AND the response status code and body are observable by the test

#### Scenario: Request body and headers are forwarded correctly

- GIVEN a test request with a JSON body and custom headers
- WHEN the request is issued through the test harness
- THEN the application receives the body parsed as JSON
- AND the headers are accessible in the request object

### Requirement: Auth Header and Database Cleanup Helpers

The system MUST provide test helpers for constructing authenticated request headers and for cleaning up database state between tests.

#### Scenario: Helper generates valid Bearer token headers

- GIVEN a helper that creates a valid JWT access token for a test user with a known `id` and `role`
- WHEN an authenticated request is constructed using the helper
- THEN the request includes an `Authorization` header with value `Bearer <token>`
- AND the `authenticate` middleware accepts the token and attaches the user to the request

#### Scenario: Helper generates headers for different roles

- GIVEN helpers that create tokens for `"admin"` and `"user"` roles respectively
- WHEN requests are constructed for each role
- THEN each request carries a token whose payload reflects the corresponding role
- AND the `authorize` middleware permits or denies access according to that role

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

#### Scenario: Error handler handles unexpected errors

- GIVEN a route that throws a native JavaScript `Error` (not an `AppError`)
- WHEN the request is processed by the application
- THEN the response status is `500`
- AND the response body contains `success: false` and a generic server error message

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

#### Scenario: Full lifecycle fails at authentication when token is missing

- GIVEN a registered and logged-in user
- WHEN a request to a protected endpoint is made without an `Authorization` header
- THEN the protected endpoint responds with status `401`
- AND the login and registration steps do NOT affect this outcome
