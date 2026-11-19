# Spec Delta

## ADDED Requirements

### Requirement: Viewer session forwarded with defined operations
When a request to the app's server carries a session, the server SHALL forward that session to the dmbk GraphQL API with the operation, alongside the app's own key. The browser SHALL never receive or send the session token itself. A request without a session SHALL be forwarded anonymously, as before. A session the API doesn't recognise SHALL NOT make a public operation fail: the operation SHALL return the same data an anonymous request gets.

#### Scenario: Signed-in request
- **WHEN** a signed-in person's editor requests a defined operation
- **THEN** the server forwards it with the app's key and the viewer's session, and the API answers as that viewer

#### Scenario: Signed-out request
- **WHEN** a signed-out person's editor requests a defined operation
- **THEN** the server forwards it with the app's key only, and public data loads as it did before this change

#### Scenario: Stale session on a public operation
- **WHEN** a request carries a session that has expired or been revoked, for a public operation such as listing LoRAs
- **THEN** the operation returns the public data, not an error
