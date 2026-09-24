# Refresh Token Limitation Documentation Specification

## Purpose

This specification documents a known architectural limitation of the refresh-token rotation mechanism: the system stores a single refresh-token hash per user. Consequently, logging in on a second device invalidates the first device's session. The documentation SHALL make this behavior explicit, explain why it occurs, and provide guidance for users or client applications that need concurrent sessions.

## Requirements

### Requirement: README Documents Single-Hash Refresh-Token Behavior

The project's `README.md` MUST contain a section describing the refresh-token limitation. The section SHALL state that only one active refresh token is retained per user, that a new login overwrites the stored hash, and that the previously issued refresh token becomes invalid. The section SHALL be labeled clearly (for example, "Known Limitation" or "Refresh Token Rotation") so that readers can locate it quickly.

#### Scenario: Developer reads README and understands the limitation

- GIVEN a developer opens `README.md`
- WHEN they search for "refresh token" or browse the authentication section
- THEN they find a subsection that explicitly states "only one refresh token is stored per user"
- AND the subsection explains that a new login invalidates previous refresh tokens

#### Scenario: README explains the mechanism

- GIVEN a developer reads the refresh-token limitation section
- WHEN they review the content
- THEN the section describes that the system stores a single hash in the user record
- AND it clarifies that this is an intentional simplicity trade-off, not a bug

### Requirement: README Provides Workaround Guidance

The refresh-token limitation section MUST include practical guidance for consumers that need multiple concurrent sessions. The guidance SHALL describe the recommended client-side or operational pattern (for example, sharing the same refresh token across tabs, using a single-device flow, or planning for re-authentication on device switch).

#### Scenario: Consumer finds actionable workaround

- GIVEN a developer needs to support a user with both a mobile and a web session
- WHEN they read the workaround guidance in `README.md`
- THEN they find at least one recommended pattern for handling concurrent-device scenarios
- AND the guidance does not suggest disabling token rotation

#### Scenario: Workaround guidance is placed adjacent to the limitation

- GIVEN the refresh-token limitation is documented in a subsection
- WHEN the developer finishes reading the limitation description
- THEN the next paragraph or bullet list presents the workaround guidance
- AND no unrelated content separates the limitation from its workaround

### Requirement: Documentation Does Not Misrepresent Security Guarantees

The refresh-token documentation MUST NOT claim that the system supports unlimited concurrent refresh tokens or multi-device session persistence unless that capability is added in a future change. Any security benefits of token rotation (for example, theft detection) MAY be mentioned, but they SHALL be described accurately and SHALL not imply multi-device support.

#### Scenario: Security claims are accurate

- GIVEN a developer reads the entire refresh-token section
- WHEN they evaluate the security claims
- THEN no sentence implies that multiple devices can hold independent valid refresh tokens simultaneously
- AND any mention of "rotation" is paired with the single-hash caveat
