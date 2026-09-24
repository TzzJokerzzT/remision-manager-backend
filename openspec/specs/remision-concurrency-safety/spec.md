# Remision Concurrency Safety Specification

## Purpose
Guarantee unique, strictly monotonic consecutive numbers per company for remision documents, eliminating race conditions during concurrent creation requests.

## Requirements

### Requirement: Atomic Consecutive Number Generation

The system MUST generate the next consecutive number for a remision atomically, such that concurrent creation requests for the same company never receive the same consecutive value.

#### Scenario: Single remision creation

- GIVEN a company with no existing remisiones
- WHEN a remision is created for that company
- THEN the remision MUST receive consecutive number 1

#### Scenario: Sequential remision creations

- GIVEN a company has existing remisiones with consecutive numbers 1 through N
- WHEN a new remision is created for that company
- THEN the remision MUST receive consecutive number N + 1

#### Scenario: Concurrent remision creations for the same company

- GIVEN a company has an existing remision with consecutive number N
- WHEN two or more remision creation requests for that company are processed concurrently
- THEN each created remision MUST receive a unique consecutive number
- AND no two remisiones MUST share the same consecutive number for the same company
- AND the assigned consecutive numbers MUST form a strictly increasing sequence without gaps

#### Scenario: Concurrent remision creations for different companies

- GIVEN company A has remisiones with consecutive numbers up to NA
- AND company B has remisiones with consecutive numbers up to NB
- WHEN remision creation requests for both companies are processed concurrently
- THEN the new remision for company A MUST receive consecutive NA + 1
- AND the new remision for company B MUST receive consecutive NB + 1
- AND neither assignment MUST interfere with the other

### Requirement: Unique Constraint Safety Net

The system MUST enforce a compound unique index on `(companyId, consecutive)` to prevent duplicate consecutive numbers at the database level.

#### Scenario: Duplicate consecutive insertion attempt

- GIVEN a remision with companyId "C" and consecutive 5 already exists in the database
- WHEN an attempt is made to insert another remision with companyId "C" and consecutive 5
- THEN the database MUST reject the insertion with a duplicate key error

### Requirement: Counter Collection Isolation

The system MUST use a dedicated counter mechanism for consecutive number generation, independent of the remision document collection, to ensure atomicity.

#### Scenario: Counter state survives remision deletions

- GIVEN a company has remisiones with consecutive numbers up to N
- WHEN all remisiones for that company are deleted
- AND a new remision is created for that company
- THEN the new remision MUST receive consecutive number N + 1
- AND the counter MUST NOT reset to 1
