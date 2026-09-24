# Health Monitoring Specification

## Purpose
Provide an HTTP endpoint that reports the operational health of the application, specifically the state of the database connection, to support load balancer health checks, monitoring systems, and deployment validation.

## Requirements

### Requirement: Health Endpoint Availability

The system MUST expose a `GET /health` endpoint that returns the current health status of the application.

#### Scenario: Health endpoint responds

- GIVEN the application is running
- WHEN a `GET` request is made to `/health`
- THEN the endpoint MUST respond with a JSON payload
- AND the response MUST include a `status` field
- AND the response MUST include a `db` field indicating the database connection state

### Requirement: Healthy State Response

The system MUST return HTTP 200 when the database connection is ready to accept operations.

#### Scenario: Database is connected

- GIVEN the application has established a database connection
- AND the database is ready to accept queries
- WHEN a `GET` request is made to `/health`
- THEN the response status code MUST be 200
- AND the response body MUST contain `status` with value `"ok"`
- AND the response body MUST contain `db` with value `"connected"`

### Requirement: Degraded State Response

The system MUST return HTTP 503 when the database connection is not ready to accept operations.

#### Scenario: Database is disconnected

- GIVEN the application has not established a database connection
- OR the database connection has been lost after startup
- WHEN a `GET` request is made to `/health`
- THEN the response status code MUST be 503
- AND the response body MUST contain `status` with value `"degraded"`
- AND the response body MUST contain `db` with value `"disconnected"`

#### Scenario: Database connection drops after startup

- GIVEN the application started successfully with a connected database
- AND the database connection is subsequently lost (e.g., network partition, database restart)
- WHEN a `GET` request is made to `/health`
- THEN the response status code MUST be 503
- AND the response body MUST reflect the disconnected state

### Requirement: Health Check Performance

The system MUST respond to health check requests without performing heavy operations.

#### Scenario: Health check under load

- GIVEN the application is under heavy request load
- WHEN a `GET` request is made to `/health`
- THEN the endpoint MUST respond within 100 milliseconds
- AND the response MUST NOT trigger a database query or reconnection attempt
