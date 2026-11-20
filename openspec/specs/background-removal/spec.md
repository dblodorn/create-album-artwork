# background-removal Specification

## Purpose

Lets someone making album artwork cut the subject out of an image layer, or keep only the parts they name, using fal.ai background-removal models. The result stays in the scene like any other image. The feature costs money per run, so only named accounts can use it.

## Requirements

### Requirement: Remove background is offered for image layers
The editor SHALL offer a Remove background action among the inline actions of the selected layer's row in the Layers panel, on image rows only. Because only the selected row shows actions, the action appears only when exactly one image layer is selected. With text, a drawing, a shape, several objects, or nothing selected, no row offers it. While freehand drawing is on, it SHALL be shown disabled.

#### Scenario: Image selected
- **WHEN** an allowed, signed-in person selects one image layer
- **THEN** the Remove background action is enabled on that image's row in the Layers panel

#### Scenario: Non-image selected
- **WHEN** the selection is a text box, a drawing, a shape, or several objects
- **THEN** no row offers Remove background (text, drawing and shape rows don't have it, and a multi-selection shows no row actions)

### Requirement: Only allowlisted accounts may use it
Use SHALL be limited to accounts whose email is on a server-configured allowlist, compared case-insensitively. An empty or missing allowlist SHALL admit nobody. Being an admin of the dmbk accounts SHALL NOT grant access by itself. When signed out, the action SHALL remain visible and SHALL say that signing in is required. When signed in with an account not on the list, it SHALL remain visible and SHALL say it isn't available for this account. The server SHALL resolve the account from the session on every request and SHALL refuse a request from anyone not on the allowlist, whatever the browser claims, without contacting fal.ai.

#### Scenario: Allowed account
- **WHEN** a person signed in as an address on the allowlist selects an image and chooses Remove background
- **THEN** the Remove background dialog opens

#### Scenario: Signed out
- **WHEN** a signed-out person selects an image layer
- **THEN** the Remove background action says that signing in is required, and no dialog opens

#### Scenario: Signed in but not allowed
- **WHEN** a person signed in with an address not on the allowlist selects an image layer
- **THEN** the action says it isn't available for this account, and no dialog opens

#### Scenario: Direct request without access
- **WHEN** a request reaches the background-removal server endpoint with no session, a forged session, or an account not on the allowlist
- **THEN** it is refused with an authorization error, and fal.ai is not called

#### Scenario: Empty allowlist
- **WHEN** the allowlist is unset or empty
- **THEN** no account can use background removal, including admins

### Requirement: Remove background dialog
Choosing Remove background SHALL open a dialog showing the selected image and these controls:
- **Model choice:** three options, each with a one-line description of its trade-off. Bria RMBG 3.0 is selected by default, with BiRefNet v2 and Pixelcut as the alternatives.
- **"What to keep" prompt:** an optional field, shown only while RMBG 3.0 is selected. It is limited to 300 characters. Empty means the image's obvious subject.
- **Keep original:** a checkbox, unchecked each time the dialog opens.
- **Remove**, which starts processing, and **Cancel**.

While the dialog is open, the canvas SHALL NOT be editable, so the layer being processed can't change underneath it.

#### Scenario: Opening the dialog
- **WHEN** the dialog opens for a selected image
- **THEN** it shows that image, RMBG 3.0 selected, an empty "What to keep" field, and Keep original unchecked

#### Scenario: Prompt only for RMBG 3.0
- **WHEN** the person switches the model to BiRefNet v2 or Pixelcut
- **THEN** the "What to keep" field is hidden and no prompt is sent

#### Scenario: Prompt too long
- **WHEN** the person types more than 300 characters into "What to keep"
- **THEN** the field accepts no more characters

### Requirement: Processing shows progress and can be abandoned
After Remove, the dialog SHALL show that processing is under way and SHALL ignore further Remove presses until it finishes. Processing SHALL keep working for runs that take up to two minutes. If the person cancels or closes the dialog while processing, the canvas SHALL be left unchanged, and any result that arrives later SHALL be discarded. If processing fails, the dialog SHALL show a short error message and let the person try again with the same or different settings, without closing.

#### Scenario: Slow run
- **WHEN** fal.ai takes 40 seconds to process the image
- **THEN** the dialog shows it is still working for the whole time, then shows the result

#### Scenario: Cancel while processing
- **WHEN** the person cancels while processing is under way
- **THEN** the dialog closes, the canvas is unchanged, and the result that arrives later is not applied

#### Scenario: Failure
- **WHEN** fal.ai returns an error or can't be reached
- **THEN** the dialog shows a short error message with a way to try again, and the canvas is unchanged

#### Scenario: Not set up
- **WHEN** the server has no fal.ai key configured
- **THEN** the dialog says background removal isn't set up, distinct from a processing failure

### Requirement: Preview before applying
When processing succeeds, the dialog SHALL show the result over a transparency checkerboard before anything changes on the canvas. It SHALL then offer three actions:
- **Apply**, which applies the result as described in the next requirement;
- **Try again**, which returns to the settings with the model and prompt kept, so they can be changed and run again;
- **Cancel**, which closes the dialog and leaves the canvas unchanged.

#### Scenario: Preview
- **WHEN** processing succeeds
- **THEN** the cutout appears over a checkerboard in the dialog, and the canvas is still unchanged

#### Scenario: Try again with a prompt
- **WHEN** the person chooses Try again, types "only the guitar" and presses Remove
- **THEN** a new result is produced and previewed, replacing the previous preview

### Requirement: Applying the result
With Keep original unchecked, Apply SHALL replace the selected image layer's picture with the cutout in place. The layer SHALL keep its position, on-canvas size, rotation, flip, shadow, opacity and stacking order, and SHALL remain selected.

With Keep original checked, Apply SHALL instead add the cutout as a new image layer directly above the original, with the same position, on-canvas size, rotation, flip, shadow and opacity, and SHALL select it. The original layer SHALL be left unchanged.

In both cases the dialog SHALL close.

#### Scenario: Replace in place
- **WHEN** a rotated, shadowed image in the middle of the stack has its background removed with Keep original unchecked, and the person chooses Apply
- **THEN** the same layer now shows the cutout, with the same position, size, rotation, shadow and stacking position, and it is selected

#### Scenario: Keep original
- **WHEN** the person checks Keep original and chooses Apply
- **THEN** a new layer with the cutout sits directly above the original, matching its position, size and rotation, and is selected, and the original is unchanged beneath it

### Requirement: Results persist like other images
An applied cutout SHALL be stored in the scene as part of the image itself, at no more than the size limit that applies to uploaded images, with its transparency kept. It SHALL survive a page reload and a JSON export followed by a JSON load, and SHALL appear, with transparency, in the PNG export. None of this SHALL depend on fal.ai's servers continuing to serve the result.

#### Scenario: Reload after applying
- **WHEN** the person applies a cutout and reloads the page
- **THEN** the cutout is restored with its transparency

#### Scenario: Export
- **WHEN** the person exports a PNG after applying a cutout over a coloured background
- **THEN** the background colour shows through where the cutout is transparent

### Requirement: Server keeps fal.ai behind a narrow, safe endpoint
The app SHALL call fal.ai only from its server, with a key read from server-only configuration. The key SHALL NOT appear in any response, page, script or bundle sent to the browser. The server SHALL:
- accept only the three offered models;
- accept only PNG, JPEG or WebP input up to a fixed size limit;
- reject a prompt longer than 300 characters, or a prompt sent with a model other than RMBG 3.0;
- refuse requests that don't come from the app's own origin.

All of these refusals SHALL happen without calling fal.ai.

Errors returned to the browser SHALL be short messages with no key, no upstream response body and no stack trace. A missing key SHALL be reported as a configuration error, distinct from a processing failure. A person SHALL only be able to read the status and result of runs they started.

#### Scenario: Unknown model
- **WHEN** a request names a model other than the three offered
- **THEN** it is refused as a bad request, and fal.ai is not called

#### Scenario: Oversized or wrong-type image
- **WHEN** a request sends an image larger than the limit, or a file that isn't PNG, JPEG or WebP
- **THEN** it is refused as a bad request, and fal.ai is not called

#### Scenario: Cross-site request
- **WHEN** a background-removal request comes from another site
- **THEN** it is refused, and fal.ai is not called

#### Scenario: Someone else's run
- **WHEN** a person asks for the status or result of a run they didn't start
- **THEN** it is refused or reported as not found
