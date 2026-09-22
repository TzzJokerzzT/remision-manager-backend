# api-pagination Specification

## Purpose

This specification defines offset-based pagination for the list endpoints of the remision-manager-backend project. List endpoints (`remision`, `company`, `client`, `driver`) SHALL accept `limit` and `page` query parameters, validate and coerce them at the boundary, and return a paginated response object that exposes the page of `items` plus pagination metadata (`total`, `limit`, `page`, `totalPages`). Pagination SHALL compose with the existing `search` and `companyId` filters without changing their behavior.

This capability is additive to the existing list behavior, which currently returns a bare array of every matching record. The response shape change is a breaking contract change for consumers of these four list endpoints.

## Requirements

### Requirement: Pagination Query Parameter Validation

The system SHALL accept `limit` and `page` as query-string parameters on list endpoints, coerce them to numeric values, and validate them as positive integers. `limit` SHALL default to `20` and SHALL be capped at a maximum of `100`. `page` SHALL default to `1`. Invalid values MUST be rejected with an HTTP `422` response.

#### Scenario: Valid limit and page are accepted

- GIVEN a list endpoint receives `limit=10` and `page=2` as query-string values
- WHEN the request is validated
- THEN the values are coerced to the numbers `10` and `2`
- AND the request proceeds with `limit` equal to `10` and `page` equal to `2`

#### Scenario: Missing parameters use defaults

- GIVEN a list endpoint receives no `limit` or `page` query parameters
- WHEN the request is validated
- THEN `limit` defaults to `20`
- AND `page` defaults to `1`

#### Scenario: Non-numeric values are rejected

- GIVEN a list endpoint receives a non-numeric value such as `limit=abc` or `page=xyz`
- WHEN the request is validated
- THEN the request is rejected with HTTP `422`

#### Scenario: Negative values are rejected

- GIVEN a list endpoint receives `limit=-5` or `page=-1`
- WHEN the request is validated
- THEN the request is rejected with HTTP `422`

#### Scenario: Zero values are rejected

- GIVEN a list endpoint receives `limit=0` or `page=0`
- WHEN the request is validated
- THEN the request is rejected with HTTP `422`

#### Scenario: Non-integer values are rejected

- GIVEN a list endpoint receives `limit=10.5` or `page=2.5`
- WHEN the request is validated
- THEN the request is rejected with HTTP `422`

#### Scenario: Limit above the maximum is rejected

- GIVEN a list endpoint receives `limit=500`
- WHEN the request is validated
- THEN the request is rejected with HTTP `422`
- AND the value is NOT silently clamped to the maximum

### Requirement: Paginated Response Shape

The system MUST return list results shaped as `PaginationResponseDTO<T>` with the fields `items`, `total`, `limit`, `page`, and `totalPages`, instead of a bare array. `items` SHALL be the array of records for the current page, `total` the count of all records matching the filter, `limit` the requested page size, `page` the requested page number, and `totalPages` the total number of pages.

#### Scenario: List endpoint returns the paginated shape

- GIVEN a list endpoint is called with valid pagination parameters
- WHEN the response is returned
- THEN `data` is an object containing the keys `items`, `total`, `limit`, `page`, and `totalPages`
- AND `items` is an array
- AND `total` is a non-negative integer
- AND `limit` and `page` are the validated integer values
- AND `totalPages` is a non-negative integer

#### Scenario: Pagination metadata matches the requested page

- GIVEN a list endpoint is called with `limit=10` and `page=2` and at least `11` matching records exist
- WHEN the response is returned
- THEN `limit` equals `10`
- AND `page` equals `2`
- AND `items` contains at most `10` records

#### Scenario: Response shape is a breaking change from a bare array

- GIVEN existing consumers of the four list endpoints expect `data` to be a bare array
- WHEN the paginated response is returned
- THEN `data` is an object, not an array
- AND consumers that treat `data` as an array SHALL be updated (documented breaking contract change)

### Requirement: Repository Pagination with Skip and Limit

The system MUST apply offset-based pagination at the repository layer using `skip` and `limit` derived from `page` and `limit`, applying the same filter used to fetch records. The repository MUST compute `total` by counting documents matching the same filter, independently of pagination.

#### Scenario: Repository returns the correct page slice

- GIVEN a repository `listByOwner` call with `page=2` and `limit=20` over a filter matching `45` records
- WHEN the repository executes
- THEN the returned `items` contains the records at positions `21` through `40` in the filter's ordering
- AND the returned `total` equals `45`

#### Scenario: Repository counts total independently of the page slice

- GIVEN a filter that matches more records than fit on the requested page
- WHEN the repository executes pagination
- THEN `total` reflects the full count of matching records
- AND `items` contains at most `limit` records

#### Scenario: Empty result set returns zero total and empty items

- GIVEN a repository `listByOwner` call whose filter matches no records
- WHEN the repository executes
- THEN the returned `items` is an empty array
- AND the returned `total` equals `0`

#### Scenario: Page beyond the last page returns empty items

- GIVEN a filter matching `10` records and a request for `page=3` with `limit=20`
- WHEN the repository executes
- THEN the returned `items` is an empty array
- AND the returned `total` still equals `10`

### Requirement: Total Pages Computation

The system MUST derive `totalPages` as `Math.ceil(total / limit)` at the use-case layer, keeping the presentation-shape concern out of the repository.

#### Scenario: Exact division yields an integer page count

- GIVEN `total` equals `40` and `limit` equals `20`
- WHEN `totalPages` is computed
- THEN `totalPages` equals `2`

#### Scenario: Remainder rounds up to the next page

- GIVEN `total` equals `45` and `limit` equals `20`
- WHEN `totalPages` is computed
- THEN `totalPages` equals `3`

#### Scenario: Zero total yields zero pages

- GIVEN `total` equals `0` and `limit` equals `20`
- WHEN `totalPages` is computed
- THEN `totalPages` equals `0`

#### Scenario: Limit greater than total yields a single page

- GIVEN `total` equals `5` and `limit` equals `20`
- WHEN `totalPages` is computed
- THEN `totalPages` equals `1`

### Requirement: Pagination Composes with Existing Filters

The system MUST apply pagination on top of the existing `search` and `companyId` filters without changing the behavior of those filters. The `total` count SHALL reflect the filtered result set, not the unfiltered set.

#### Scenario: Pagination composes with search filter

- GIVEN a list endpoint is called with a `search` term and pagination parameters
- WHEN the request is processed
- THEN the returned `items` contains only records matching the search term
- AND the returned `total` equals the count of records matching the search term
- AND pagination slices only the filtered result set

#### Scenario: Pagination composes with companyId filter

- GIVEN a list endpoint is called with a `companyId` and pagination parameters
- WHEN the request is processed
- THEN the returned `items` contains only records belonging to that company
- AND the returned `total` equals the count of records belonging to that company

#### Scenario: Pagination composes with combined search and companyId filters

- GIVEN a list endpoint is called with both `search` and `companyId` together with pagination parameters
- WHEN the request is processed
- THEN the returned `items` matches both filters simultaneously
- AND the returned `total` equals the count of records matching both filters

#### Scenario: Filter behavior is unchanged by pagination

- GIVEN a `search` and/or `companyId` filter applied with no pagination previously returned a specific set of records
- WHEN the same filter is applied with pagination
- THEN the set of records matched by the filter is identical
- AND pagination only limits how many of those matching records are returned per page
