# Spec Delta

## ADDED Requirements

### Requirement: Operations can require an admin
An operation the app defines MAY be marked as requiring a signed-in admin. For such an operation, the app's server SHALL check the request's session itself before calling the API:
- With no session, or one the API doesn't recognise, the server SHALL refuse the request as unauthenticated.
- With a session whose account isn't an admin, the server SHALL refuse it as forbidden.

In either case the API SHALL NOT be called. This check SHALL apply even when the API itself would answer the operation for anyone. Operations that aren't marked SHALL behave as before.

#### Scenario: Signed out
- **WHEN** a request without a session asks for an admin-only operation
- **THEN** the server responds unauthenticated and doesn't call the API

#### Scenario: Not an admin
- **WHEN** a signed-in person who isn't an admin asks for an admin-only operation
- **THEN** the server responds forbidden and doesn't call the API

#### Scenario: Admin
- **WHEN** an admin asks for an admin-only operation
- **THEN** the server forwards it with the admin's session and returns the result

#### Scenario: Public operations unchanged
- **WHEN** a signed-out person asks for a public operation such as listing LoRAs
- **THEN** it's forwarded and answered as before
