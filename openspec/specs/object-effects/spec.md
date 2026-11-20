# object-effects Specification

## Purpose

Lets someone apply visual effects to a single layer from the Layers panel's Effects popout, starting with a Gaussian-style blur that works on every kind of layer and stays with the scene.

## Requirements

### Requirement: Blur any layer
The Effects popout SHALL offer **Blur** with an intensity slider from 0 (off) to 50, measured in artboard units, and showing the current value. It SHALL work on every kind of layer: images, text, drawings and shapes. The blur SHALL be Gaussian-style and centred on the object, and SHALL spread past the object's edges without being clipped. It SHALL look the same at any zoom: the radius is in artboard units, so it scales with the view and with the 3000 px export. Moving the slider SHALL update the canvas live. One drag SHALL be one undo step named "Blur". A **Reset** control SHALL return blur to 0, and SHALL be disabled when blur is already 0. Blur SHALL NOT change the object's position, size, selection handles or hit area.

#### Scenario: Blur text
- **WHEN** a text box is selected and the person opens Effects and drags Blur to 12
- **THEN** the text renders blurred on the canvas as the slider moves, the popout shows 12, and the Edit menu offers "Undo Blur"

#### Scenario: One drag, one undo
- **WHEN** the person drags the Blur slider from 0 through several values to 20 and then undoes once
- **THEN** blur is back to 0

#### Scenario: Works on every layer type
- **WHEN** an image, a drawing and a shape are each given blur 10
- **THEN** each renders blurred

#### Scenario: Reset
- **WHEN** a layer has blur 15 and the person clicks Reset
- **THEN** blur is 0 and Reset is disabled

### Requirement: Blur persists and exports
A layer's blur SHALL be saved with the scene. It SHALL survive a page reload and a JSON export followed by a JSON load, SHALL appear in the PNG export at the same relative strength as on the canvas, and SHALL be undone and redone with the rest of the object's properties. A scene saved without blur SHALL load with blur 0.

#### Scenario: Reload keeps blur
- **WHEN** a shape has blur 10 and the page is reloaded
- **THEN** the shape still renders blurred and the popout shows 10

#### Scenario: Export
- **WHEN** a layer has blur and the person exports a PNG
- **THEN** the export shows the blur, scaled to the 3000 px size

### Requirement: Unsupported browsers degrade clearly
If the browser can't blur canvas drawing, layers SHALL render without blur and nothing SHALL break. The Effects popout SHALL say that blur isn't supported in this browser. Blur values already in the scene SHALL be kept, so they show again in a browser that supports it.

#### Scenario: No canvas filter support
- **WHEN** the editor runs in a browser without canvas filter support
- **THEN** the Blur slider is disabled with a note that blur isn't supported here, and blurred layers render sharp without errors
