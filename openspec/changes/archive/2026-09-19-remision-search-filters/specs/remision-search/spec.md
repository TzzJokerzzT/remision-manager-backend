# remision-search Specification

## Purpose

This specification defines search and filtering behavior for the remision list endpoint (`GET /remisiones`). It adds four query filters — client name (`clientName`), driver/conductor name (`driverName`), remision type (`type`), and creation date range (`from`/`to`) — that allow locating remisiones by the dimensions that most often drive a lookup. Each new filter MUST compose with the existing `search` (MongoDB `$text` over `notes`), `companyId`, and offset pagination, and the `total` count SHALL always reflect the fully filtered result set.

This capability is additive: the existing `search` and `companyId` filters, and the existing pagination behavior, are unchanged by this specification.

## Requirements

### Requirement: Client Name Filter

The system SHALL accept an optional `clientName` query parameter on `GET /remisiones`. When `clientName` is provided with a non-empty, non-whitespace value, the system MUST return only remisiones whose associated client's `name` contains the value as a case-insensitive substring, and MUST NOT match against the client's `documentId` or any other field. The system MUST resolve the matching client identifiers and filter the remision `clientId` using an `$in` match over those identifiers. A `clientName` value that is empty or whitespace-only MUST be ignored (treated as if the parameter were not supplied).

#### Scenario: Client name matches as a case-insensitive substring

- GIVEN remisiones whose clients have names "Acme Corp", "ACME Supplies", and "Beta LLC"
- WHEN a request is made with `clientName=acme`
- THEN the response contains only the remisiones whose client `name` contains "acme" case-insensitively
- AND remisiones of "Beta LLC" are excluded

#### Scenario: Client name with different casing matches

- GIVEN a client whose `name` is "Acme Corp"
- WHEN a request is made with `clientName=ACME` or `clientName=Acme`
- THEN the remisiones of that client are included
- AND the match is case-insensitive regardless of the casing of either the query value or the stored `name`

#### Scenario: Client name matches name only, not documentId

- GIVEN a client whose `name` is "Beta LLC" and whose `documentId` is "ACME-9001"
- WHEN a request is made with `clientName=acme`
- THEN remisiones of that client are excluded
- AND the filter matches the `name` field only, never `documentId`

#### Scenario: No client name match returns empty results

- GIVEN no client has a `name` containing the supplied value
- WHEN a request is made with `clientName=zzz`
- THEN the response `items` is an empty array
- AND `total` equals `0`

#### Scenario: Empty or whitespace clientName is ignored

- GIVEN remisiones exist and a request is made with `clientName=` (empty) or `clientName=%20%20` (whitespace-only)
- WHEN the request is validated
- THEN the `clientName` filter is ignored
- AND the response behaves as if no `clientName` parameter was supplied

### Requirement: Driver Name Filter

The system SHALL accept an optional `driverName` query parameter on `GET /remisiones`. When `driverName` is provided with a non-empty, non-whitespace value, the system MUST return only remisiones whose associated driver's `name` contains the value as a case-insensitive substring, and MUST NOT match against any other driver field (such as license, plate, or document). The system MUST resolve the matching driver identifiers and filter the remision `driverId` using an `$in` match over those identifiers. Remisiones that have no driver (`driverId` undefined) MUST be excluded when `driverName` is provided.

#### Scenario: Driver name matches as a case-insensitive substring

- GIVEN remisiones whose drivers have names "Carlos Pérez", "carlos gutierrez", and "María López"
- WHEN a request is made with `driverName=carlos`
- THEN the response contains only the remisiones whose driver `name` contains "carlos" case-insensitively
- AND remisiones of "María López" are excluded

#### Scenario: No driver name match returns empty results

- GIVEN no driver has a `name` containing the supplied value
- WHEN a request is made with `driverName=zzz`
- THEN the response `items` is an empty array
- AND `total` equals `0`

#### Scenario: Remisiones without a driver are excluded when driverName is provided

- GIVEN some remisiones have no driver assigned (`driverId` undefined) and others have a driver whose `name` matches the supplied value
- WHEN a request is made with `driverName=<matching value>`
- THEN only the remisiones with a matching driver are returned
- AND remisiones with no driver are excluded

### Requirement: Type Filter

The system SHALL accept an optional `type` query parameter on `GET /remisiones`. When `type` is provided, the system MUST return only remisiones whose remision `type` exactly equals the supplied value. The only valid values are `priced` and `quantity_only`. An invalid `type` value MUST be rejected with an HTTP `422` response.

#### Scenario: Filtering by priced type

- GIVEN remisiones of type `priced` and remisiones of type `quantity_only` exist
- WHEN a request is made with `type=priced`
- THEN the response contains only remisiones whose `type` equals `priced`
- AND remisiones of type `quantity_only` are excluded

#### Scenario: Filtering by quantity_only type

- GIVEN remisiones of type `priced` and remisiones of type `quantity_only` exist
- WHEN a request is made with `type=quantity_only`
- THEN the response contains only remisiones whose `type` equals `quantity_only`
- AND remisiones of type `priced` are excluded

#### Scenario: Invalid type value is rejected

- GIVEN a request is made with `type=invalid` (or any value other than `priced` or `quantity_only`)
- WHEN the request is validated
- THEN the request is rejected with HTTP `422`

### Requirement: Date Range Filter

The system SHALL accept optional `from` and `to` query parameters on `GET /remisiones`. When provided, they MUST filter remisiones by `createdAt` inclusively: `from` maps to a `$gte` lower bound and `to` maps to a `$lte` upper bound. Either bound MAY be supplied alone, and both MAY combine. A date-only `to` value (no time component) MUST be interpreted as end-of-day so the full day is included. Invalid (non-ISO) `from` or `to` values MUST be rejected with an HTTP `422` response.

#### Scenario: from and to filter inclusively

- GIVEN remisiones with `createdAt` values spread across multiple dates
- WHEN a request is made with `from=2026-01-01` and `to=2026-01-31`
- THEN the response contains only remisiones whose `createdAt` is on or after `2026-01-01T00:00:00` and on or before `2026-01-31T23:59:59.999`
- AND remisiones outside that range are excluded

#### Scenario: from only filters from the lower bound

- GIVEN remisiones with `createdAt` values before and after a date
- WHEN a request is made with `from=2026-01-01` and no `to`
- THEN the response contains only remisiones whose `createdAt` is on or after `2026-01-01T00:00:00`
- AND remisiones before that date are excluded

#### Scenario: date-only to is interpreted as end-of-day

- GIVEN remisiones created at various times on `2026-01-31` and on later dates
- WHEN a request is made with `to=2026-01-31` and no `from`
- THEN the response contains only remisiones whose `createdAt` is on or before the end of `2026-01-31`
- AND remisiones created at any time during `2026-01-31` are included
- AND remisiones created on `2026-02-01` or later are excluded

#### Scenario: Invalid date value is rejected

- GIVEN a request is made with `from=not-a-date` or `to=2026-13-99`
- WHEN the request is validated
- THEN the request is rejected with HTTP `422`

### Requirement: Filter Composition and Total Correctness

The new filters (`clientName`, `driverName`, `type`, `from`, `to`) MUST compose with each other and with the existing `search` (notes `$text`), `companyId`, and offset pagination. The `total` count SHALL reflect the fully filtered result set, and pagination SHALL slice only that filtered set.

#### Scenario: All new filters combine with existing search and companyId

- GIVEN remisiones across multiple clients, drivers, types, and creation dates, some matching a `search` term and a `companyId`
- WHEN a request is made with `clientName`, `driverName`, `type`, `from`, `to`, `search`, and `companyId` all supplied
- THEN the response contains only remisiones satisfying every filter simultaneously
- AND the existing `search` and `companyId` behavior is unchanged

#### Scenario: total reflects the fully filtered set

- GIVEN a combination of filters that matches a subset of all remisiones owned by the caller
- WHEN a request is made with those filters and pagination parameters
- THEN `total` equals the count of remisiones matching all filters
- AND `total` does NOT equal the unfiltered count of remisiones owned by the caller

#### Scenario: Pagination slices only the filtered result set

- GIVEN a filter combination matching more records than fit on the requested page
- WHEN a request is made with pagination parameters
- THEN `items` contains at most `limit` records from the filtered set
- AND `total` still reflects the full filtered count
- AND pagination does not change which records the filters match

### Requirement: Boundary Validation of Search and Filter Parameters

The new query parameters (`clientName`, `driverName`, `type`, `from`, `to`) MUST be validated and coerced at the request boundary by a schema dedicated to the remision list endpoint. The existing pagination schema uses pass-through for unknown keys; the remision list endpoint MUST NOT allow unvalidated filter values to reach the controller. Empty or whitespace-only `clientName`/`driverName` values SHALL be trimmed and treated as absent, and invalid `type` or non-ISO `from`/`to` values MUST be rejected with HTTP `422`.

#### Scenario: New filters are validated by a dedicated remision list schema

- GIVEN the remision list endpoint receives the new query parameters
- WHEN the request is validated
- THEN `type` is validated against the allowed enum, `from`/`to` are coerced to dates and validated, and `clientName`/`driverName` are trimmed
- AND invalid values are rejected with HTTP `422` rather than passed through unvalidated

#### Scenario: Unvalidated filter values do not leak through pass-through

- GIVEN the existing pagination schema uses pass-through for unknown query keys
- WHEN a request is made with the new filter parameters
- THEN the remision list endpoint applies its dedicated schema so only validated, coerced filter values reach the controller
- AND the pass-through behavior of the pagination schema does NOT cause raw filter values to reach the controller

#### Scenario: Whitespace-only name filters are trimmed to absent

- GIVEN a request is made with `clientName=   ` or `driverName=   ` (whitespace-only)
- WHEN the request is validated
- THEN the value is trimmed and treated as absent
- AND the corresponding filter is not applied
