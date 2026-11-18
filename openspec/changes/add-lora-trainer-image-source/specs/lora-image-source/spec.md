# Spec Delta

## Purpose

Lets someone making album artwork browse the public LoRAs and generated images from lora-trainer inside the editor's image picker, and place one on the canvas so it persists and exports like any other image.

## ADDED Requirements

### Requirement: LoRA tab in the image picker
The image picker SHALL offer a LoRA tab alongside the existing Upload and URL tabs. The tab SHALL list completed, public LoRAs from lora-trainer, newest first. Each entry SHALL show the LoRA's trigger word and a preview image. LoRAs that are hidden or not completed SHALL NOT appear.

#### Scenario: Opening the tab
- **WHEN** the user opens the image picker and selects the LoRA tab
- **THEN** the first page of public LoRAs loads and shows newest first, each with its trigger word and a preview

#### Scenario: Hidden LoRA
- **WHEN** a LoRA's owner has hidden it in lora-trainer
- **THEN** it does not appear in the list

### Requirement: Browse a LoRA's generated images
Selecting a LoRA SHALL show the public images generated with it, newest first, as thumbnails. The user SHALL be able to return to the LoRA list without closing the picker. A LoRA with no public images SHALL show an empty state rather than a blank area.

#### Scenario: Viewing a LoRA's images
- **WHEN** the user selects a LoRA in the list
- **THEN** that LoRA's generated images load as thumbnails, newest first, with a way back to the LoRA list

#### Scenario: LoRA with no images
- **WHEN** the selected LoRA has no public generated images
- **THEN** the picker says there are no images for it

### Requirement: Load more on demand
Both the LoRA list and the image grid SHALL load in pages. When more results exist, the user SHALL be able to load the next page, which is appended without losing the items already shown or the current scroll position. When no more results exist, the load-more control SHALL NOT be offered.

#### Scenario: Next page
- **WHEN** more LoRAs exist than the first page shows and the user asks for more
- **THEN** the next page is appended below the current entries

#### Scenario: End of results
- **WHEN** every result has been loaded
- **THEN** no load-more control is shown

### Requirement: Add a generated image to the canvas
Picking a generated image SHALL add it to the canvas the same way an uploaded image is added: scaled to fit, centred, and selected. The picker SHALL close once the image is added. While the image is being fetched, the picker SHALL show that it is working and SHALL ignore repeated picks of the same image.

#### Scenario: Pick an image
- **WHEN** the user picks a generated image
- **THEN** the image appears on the canvas scaled to fit, centred and selected, and the picker closes

#### Scenario: Image fails to load
- **WHEN** the image cannot be fetched
- **THEN** an error message is shown, nothing is added to the canvas, and the picker stays open

### Requirement: Added images persist and export cleanly
An image added from lora-trainer SHALL survive a page reload and a JSON export followed by a JSON load, even if its original URL later stops serving. It SHALL be included in the PNG export without making the export fail.

#### Scenario: Reload
- **WHEN** the user adds a lora-trainer image and reloads the page
- **THEN** the image is still on the canvas in the same place

#### Scenario: Source URL goes away
- **WHEN** a lora-trainer image's original URL stops serving after it was added
- **THEN** the image still appears after a reload and after loading an exported JSON scene

#### Scenario: PNG export
- **WHEN** the canvas contains a lora-trainer image and the user exports a PNG
- **THEN** the PNG downloads and includes the image

### Requirement: Loading and error states
While a list or grid page loads, the picker SHALL show a loading indicator. If the API request fails, the picker SHALL show an error message with a way to retry. The other tabs SHALL keep working.

#### Scenario: API unavailable
- **WHEN** the dmbk GraphQL API cannot be reached or returns an error
- **THEN** the LoRA tab shows an error with a retry action, and the Upload and URL tabs still work

#### Scenario: Retry succeeds
- **WHEN** the user retries after the API recovers
- **THEN** the list loads normally
