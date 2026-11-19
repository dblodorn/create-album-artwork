# account-session Specification

## Purpose

Lets someone sign in to the editor with their Google account, using the shared dmbk accounts. The editor then knows who is using it and whether they are an admin, so features can later be limited to signed-in accounts.

## Requirements

### Requirement: Google sign-in through the dmbk accounts API
The app SHALL sign people in with Google, using the accounts held by the dmbk GraphQL API. The app's server SHALL exchange the Google ID token with the API for a session. The API decides who may sign in and who is an admin. The app SHALL keep no accounts, allowlist or Google client secret of its own. Any account the API admits SHALL be able to sign in, admin or not.

#### Scenario: Successful sign-in
- **WHEN** a person whose Google address the API admits completes Google sign-in
- **THEN** the app is signed in as that account without a page reload, and the top bar shows their avatar

#### Scenario: Account not admitted
- **WHEN** a person completes Google sign-in with an address the API refuses
- **THEN** the app stays signed out, shows "This Google account isn't allowed to sign in.", and creates no session

#### Scenario: Accounts API unavailable
- **WHEN** a person completes Google sign-in but the API can't be reached
- **THEN** the app stays signed out, shows that sign-in is unavailable right now, and the editor keeps working

### Requirement: Session held in an HTTP-only cookie
The session token SHALL be stored only in an HTTP-only, `SameSite=Lax` cookie on the app's own domain, marked `Secure` over HTTPS, and SHALL NOT appear in any response body, page, script or bundle sent to the browser. The cookie SHALL last no longer than the API's session (seven days). Requests that create or end a session SHALL be refused unless they come from the app's own origin.

#### Scenario: Token not readable by page scripts
- **WHEN** a signed-in page runs script that reads `document.cookie` or inspects session responses
- **THEN** the session token is not present

#### Scenario: Cross-site sign-in or sign-out attempt
- **WHEN** a request to sign in or sign out arrives from another site
- **THEN** it is refused and no session is created or ended

### Requirement: Session state follows the API
On load and after sign-in or sign-out, the app SHALL show the signed-in account the API reports for the session, or show signed out. A session the API no longer recognises (expired, revoked, or for an address removed from its list) SHALL read as signed out, and its cookie SHALL be cleared. If the API can't be reached while checking, the app SHALL show signed out without clearing the cookie, and the editor SHALL keep working.

#### Scenario: Returning visitor
- **WHEN** a person who signed in earlier reloads the app within the session's lifetime
- **THEN** the top bar shows their avatar without signing in again

#### Scenario: Session revoked elsewhere
- **WHEN** the session has been revoked at the API and the app loads
- **THEN** the app shows signed out and clears the cookie

#### Scenario: API down on load
- **WHEN** the app loads with a session cookie and the API can't be reached
- **THEN** the app shows signed out, keeps the cookie, and every editor feature works

### Requirement: Sign out
Signing out SHALL end the session at the API and clear the cookie. The cookie SHALL be cleared even when the API can't be reached.

#### Scenario: Sign out
- **WHEN** a signed-in person chooses Sign out
- **THEN** the top bar shows the sign-in control, and the session no longer works at the API

#### Scenario: Sign out while the API is down
- **WHEN** a signed-in person chooses Sign out and the API can't be reached
- **THEN** the cookie is cleared and the app shows signed out

### Requirement: Sign-in control and account menu in the top bar
When signed out, the right end of the top bar SHALL show a Google sign-in control. When signed in, it SHALL show the account's avatar: their profile picture when the API provides one, otherwise their initials (from the name, or the email when there is no name). Activating the avatar SHALL open a menu showing the account's name and email and a Sign out action. While the session is being checked, the control's space SHALL stay reserved so the top bar doesn't shift. If Google sign-in is not configured or its script can't load, the control SHALL say sign-in is unavailable, and nothing else in the top bar SHALL be affected.

#### Scenario: Signed-out top bar
- **WHEN** a signed-out person opens the app
- **THEN** a Google sign-in control appears at the right end of the top bar, after the file actions

#### Scenario: Avatar with picture
- **WHEN** a signed-in account has a profile picture
- **THEN** the top bar shows that picture as a round avatar, with the account's name as its accessible label

#### Scenario: Avatar without picture
- **WHEN** a signed-in account has no profile picture
- **THEN** the top bar shows their initials in a round avatar

#### Scenario: Account menu
- **WHEN** a signed-in person activates their avatar
- **THEN** a menu shows their name and email and a Sign out action, and it closes on Escape or on a click outside

#### Scenario: Google script blocked
- **WHEN** the Google sign-in script fails to load
- **THEN** the control says sign-in is unavailable, and the zoom controls, file actions and editor all keep working

### Requirement: Ungated features work the same signed in or out
Every editor feature that is not explicitly gated by its own capability SHALL work the same whether the person is signed in or not. A gated feature SHALL still be visible when signed out, and SHALL say what is needed to use it rather than disappearing. Signing in or out SHALL NOT reload the page or change the canvas, the autosaved scene, the selection, the zoom or the panel positions.

#### Scenario: Signed-out use
- **WHEN** a signed-out person uses the image picker (all tabs), drawing, text, layers, export and load
- **THEN** each works exactly as it does signed in

#### Scenario: Gated feature while signed out
- **WHEN** a signed-out person selects an image layer
- **THEN** the Remove background control is visible and says that signing in is required, and nothing else in the editor changes

#### Scenario: Sign in mid-edit
- **WHEN** a person signs in or out while a scene is on the canvas
- **THEN** the scene, selection, zoom and panel positions are unchanged, and gated controls update to match the new account without a reload

### Requirement: Viewer check for future gates
The app SHALL provide one way, on the server and in the browser, to learn whether the current person is signed in and whether they are an admin. The server check SHALL be resolved from the session for each request, never from anything the browser asserts, and SHALL treat a request as signed out whenever the session can't be confirmed (missing, invalid, revoked, or API unreachable).

#### Scenario: Server sees the signed-in viewer
- **WHEN** a signed-in person's request reaches a server route that asks who the viewer is
- **THEN** it gets that account's id, email, name and admin flag

#### Scenario: Fails closed
- **WHEN** a request carries no session, a forged session, or a session the API can't confirm because it's unreachable
- **THEN** the server check reports signed out

#### Scenario: Browser claims are ignored
- **WHEN** a browser request includes headers or body fields claiming to be an admin, without a valid session
- **THEN** the server check reports signed out
