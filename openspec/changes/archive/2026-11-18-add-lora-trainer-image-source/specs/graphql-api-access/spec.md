# Spec Delta

## Purpose

Defines how the album-artwork app reaches the dmbk GraphQL API: through its own server, with its own client key, limited to the operations the app defines, so the key and arbitrary queries never pass through the browser.

## ADDED Requirements

### Requirement: Server-side access with the app's own key
The app SHALL reach the dmbk GraphQL API only from its server. It SHALL identify itself with its own client API key, sent in the `X-API-Key` header. The key SHALL be read from server-only configuration and SHALL NOT appear in any response, page, script or bundle sent to the browser.

#### Scenario: Browser request
- **WHEN** the editor needs LoRA data
- **THEN** the browser calls the app's own server, the server calls the dmbk GraphQL API with the key, and the browser never receives the key

#### Scenario: Key not in client bundle
- **WHEN** the production build's client assets are searched for the key value or the `X-API-Key` header name being set
- **THEN** neither is found

### Requirement: Only defined operations are forwarded
The app's server SHALL forward only the read-only operations the app itself defines, identified by name, with their variables. It SHALL refuse any other operation, any raw query text supplied by the browser, and any mutation, without calling the API.

#### Scenario: Known operation
- **WHEN** the browser requests a defined operation with valid variables
- **THEN** the server forwards it to the API and returns the API's data

#### Scenario: Unknown operation or raw query
- **WHEN** the browser sends an operation name the app doesn't define, or sends query text
- **THEN** the server responds with a client error and does not call the API

### Requirement: Configurable endpoint
The API endpoint SHALL default to production (`https://graphql.dmbk.network/graphql`) and SHALL be overridable through server configuration, so a local run can point at a local API.

#### Scenario: Override for local development
- **WHEN** the endpoint is configured to a local API URL
- **THEN** all forwarded operations go to that URL

### Requirement: Failure handling
When the key is missing, the API cannot be reached, the API refuses the key, or the API returns GraphQL errors, the server SHALL respond with an error status and a short message that contains no key, no upstream response body beyond the error message, and no stack trace. A missing key SHALL be reported as a configuration error, distinct from an upstream failure.

#### Scenario: Key not configured
- **WHEN** a defined operation is requested and no key is configured
- **THEN** the server responds with a configuration error and does not call the API

#### Scenario: Upstream failure
- **WHEN** the API is unreachable, times out, or rejects the key
- **THEN** the server responds with an upstream error status and a generic message, and the editor shows its error state
