# Spec Delta

## Purpose

Lets the owner of the dmbk-photos collection browse and keyword-search it inside the editor's image picker, and place a photo on the canvas so it persists and exports like any other image. Limited to admins until photos are tied to the accounts that own them.

## ADDED Requirements

### Requirement: Photos tab in the image picker
The image picker SHALL offer a Photos tab alongside the Upload, URL and LoRA tabs. The tab SHALL be visible to everyone, and SHALL show what is needed when it can't be used:
- Signed out, it SHALL say to sign in to browse photos, with no photos shown.
- Signed in with an account that isn't an admin, it SHALL say the photo collection isn't available for this account.
- Signed in as an admin, it SHALL show the collection.

The other tabs SHALL work the same in every case.

#### Scenario: Signed out
- **WHEN** a signed-out person opens the Photos tab
- **THEN** it says to sign in to browse photos, and shows no photos

#### Scenario: Not an admin
- **WHEN** a signed-in person whose account isn't an admin opens the Photos tab
- **THEN** it says the photo collection isn't available for this account, and shows no photos

#### Scenario: Admin
- **WHEN** an admin opens the Photos tab
- **THEN** it shows the collection's photos

### Requirement: Browse the collection
For an admin, the Photos tab SHALL show the collection as a grid of thumbnails, newest first, including photos that are ready but hidden on the photo site. Each hidden photo SHALL carry a visible "Hidden" marker. Photos that are still processing or that failed SHALL NOT appear. Each thumbnail SHALL have an accessible name: the photo's title, or "Untitled photo" when it has none.

#### Scenario: Hidden photo
- **WHEN** the collection includes a ready photo that is hidden on the photo site
- **THEN** it appears in the grid with a "Hidden" marker

#### Scenario: Processing photo
- **WHEN** a photo is still processing
- **THEN** it doesn't appear in the grid

### Requirement: More photos load as the grid scrolls
The grid SHALL load in pages. When more photos exist, the next page SHALL start loading automatically once the end of the grid scrolls into view, with no button to press. While a page loads, the grid SHALL show a loading indicator at its end. The grid SHALL request each page once, and SHALL stop requesting when the collection is exhausted. If the first page doesn't fill the visible grid and more photos exist, the next page SHALL load without the person scrolling.

#### Scenario: Scroll to the end
- **WHEN** an admin scrolls the grid to the last loaded photos and more exist
- **THEN** the next page loads and its photos are appended in order, without duplicates

#### Scenario: End of the collection
- **WHEN** every photo has loaded
- **THEN** scrolling to the end requests nothing more

### Requirement: Search by keyword
The Photos tab SHALL provide a keyword search. Entering one or more keywords SHALL show only photos that carry every keyword entered, newest first, replacing the current results, and paging SHALL continue within those results. Keywords SHALL be matched the way the photo site normalises them, so letter case and surrounding spaces don't matter. Clearing the search SHALL show the whole collection again. When no photo matches, the tab SHALL say so. Results from an earlier search that arrive after a newer one SHALL be ignored.

#### Scenario: Two keywords
- **WHEN** an admin searches for "beach" and "night"
- **THEN** only photos carrying both keywords are shown

#### Scenario: No match
- **WHEN** an admin searches for a keyword no photo carries
- **THEN** the tab says no photos match, and shows no photos

#### Scenario: Clear the search
- **WHEN** an admin clears the search
- **THEN** the whole collection is shown again, newest first

### Requirement: Add a photo to the canvas
Picking a photo SHALL add it to the canvas the same way an uploaded image is added: at the same default size and position, and selected. The image added SHALL be the photo's display size, downscaled so its longer side is at most 2048 pixels, and embedded in the scene, so the scene doesn't depend on the photo's URL. The picker SHALL close only once the image has been added. If the image can't be fetched, the picker SHALL stay open and say so.

#### Scenario: Pick a photo
- **WHEN** an admin picks a photo
- **THEN** it appears on the canvas, selected, and the picker closes

#### Scenario: Fetch fails
- **WHEN** the photo's image can't be fetched
- **THEN** the picker stays open and shows an error, and the canvas is unchanged

### Requirement: Added photos persist and export cleanly
A photo added from the collection SHALL survive a page reload and a JSON export followed by a JSON load. It SHALL appear in the PNG export, and SHALL NOT prevent the export (the canvas SHALL NOT become tainted).

#### Scenario: Export after adding a photo
- **WHEN** an admin adds a photo and downloads the PNG
- **THEN** the export succeeds and includes the photo

#### Scenario: Reload
- **WHEN** an admin adds a photo and reloads the page, even while signed out
- **THEN** the photo is still on the canvas

### Requirement: Loading and error states
While the first page loads, the tab SHALL show a loading indicator. If a request fails, the tab SHALL show an error message with a way to retry, and the photos already shown SHALL stay. The other tabs SHALL keep working.

#### Scenario: API unavailable
- **WHEN** the dmbk GraphQL API can't be reached
- **THEN** the Photos tab shows an error with a retry action, and the other tabs still work

#### Scenario: Retry succeeds
- **WHEN** the admin retries after the API recovers
- **THEN** the photos load normally
