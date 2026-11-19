# Spec Delta

## REMOVED Requirements

### Requirement: No features gated yet
**Reason**: Background removal is the first gated feature. It runs on the app owner's paid fal.ai account, so it is limited to named accounts (see the `background-removal` capability). The guarantee that signing in or out leaves the editor's state alone still holds, and moves to the requirement below.
**Migration**: None for users. Every feature that existed before this change still works signed out. Gated features state their own access rule in their capability spec.

## ADDED Requirements

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
