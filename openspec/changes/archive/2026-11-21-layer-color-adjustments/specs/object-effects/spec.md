# Spec Delta

## ADDED Requirements

### Requirement: Colour adjustments for non-text layers
For a selected layer that isn't text (an image, a drawing or a shape), the Effects popout SHALL offer, below Blur:
- **Brightness**, **Contrast** and **Saturation**, each a slider from −100 to +100 showing its current value, with 0 meaning unchanged;
- **Tint**, a colour plus a **Strength** slider from 0% to 100% showing its current value, with 0% meaning no tint.

Their effect on the layer SHALL be:
- Brightness +100 makes the layer twice as bright and −100 makes it black.
- Contrast +100 doubles the contrast and −100 makes the layer flat mid-grey.
- Saturation +100 doubles the saturation and −100 makes the layer greyscale.
- Tint colours the layer's visible pixels towards the chosen colour by Strength, keeping their light and dark (100% is the layer's shading in that colour). Transparent areas SHALL stay transparent.

The adjustments SHALL combine with each other and with Blur on the same layer. They SHALL keep the layer's opacity, position, size, selection handles and hit area unchanged, and SHALL look the same at any zoom.

Moving a slider SHALL update the canvas live, and one drag SHALL be one undo step named after the control: "Brightness", "Contrast", "Saturation" or "Tint" (a Strength drag is a "Tint" step). Choosing a tint colour SHALL be one "Tint" step and SHALL apply at once; choosing a colour while Strength is 0% SHALL keep the colour for when Strength is raised.

For a text layer the popout SHALL show Blur only.

#### Scenario: Brighten an image
- **WHEN** an image is selected and the person opens Effects and drags Brightness to 40
- **THEN** the image renders brighter as the slider moves, the popout shows 40, and the Edit menu offers "Undo Brightness"

#### Scenario: Greyscale
- **WHEN** a drawing has Saturation set to −100
- **THEN** it renders in greys only

#### Scenario: Tint a shape
- **WHEN** a shape is selected, the person picks a red tint colour and drags Strength to 100%
- **THEN** the shape renders in shades of red, and the area around it stays transparent

#### Scenario: One drag, one undo
- **WHEN** the person drags Contrast from 0 through several values to 30 and then undoes once
- **THEN** contrast is back to 0

#### Scenario: Combined with blur
- **WHEN** an image has Blur 10, Brightness 20 and Tint 50%
- **THEN** it renders blurred, brighter and tinted at the same time

#### Scenario: Text shows Blur only
- **WHEN** a text box is selected and the person opens Effects
- **THEN** the popout shows Blur and none of Brightness, Contrast, Saturation or Tint

### Requirement: Reset each control
Each control in the Effects popout (Blur, Brightness, Contrast, Saturation and Tint) SHALL have its own **Reset**, which SHALL return only that control to its neutral value (0, or 0% Strength for Tint) as one undo step named after the control. A control's Reset SHALL be disabled while the control is at its neutral value. Resetting Tint SHALL keep the chosen tint colour.

#### Scenario: Reset one control
- **WHEN** an image has Brightness 30 and Saturation −50 and the person clicks Brightness's Reset
- **THEN** Brightness is 0 and its Reset is disabled, and Saturation is still −50

#### Scenario: Reset is undoable
- **WHEN** the person resets Tint from 60% and then undoes
- **THEN** Tint Strength is 60% again, with the same colour

#### Scenario: Neutral controls
- **WHEN** a layer with no effects is selected and the person opens Effects
- **THEN** every Reset in the popout is disabled

### Requirement: Colour adjustments persist and export
A layer's brightness, contrast, saturation, tint colour and tint strength SHALL be saved with the scene. They SHALL survive a page reload and a JSON export followed by a JSON load, SHALL appear in the PNG export as they look on the canvas, and SHALL be undone and redone with the rest of the object's properties. Copies made by paste SHALL keep the adjustments. A scene saved without them SHALL load with every adjustment at its neutral value.

#### Scenario: Reload keeps adjustments
- **WHEN** an image has Contrast 25 and Tint 40% in blue, and the page is reloaded
- **THEN** the image still renders with them, and the popout shows Contrast 25 and Tint 40% in blue

#### Scenario: Export
- **WHEN** a layer has colour adjustments and the person exports a PNG
- **THEN** the export shows the layer adjusted as on the canvas

#### Scenario: Older scene
- **WHEN** the person loads a JSON scene saved before this change
- **THEN** every layer renders as before, and its adjustments read as neutral

## MODIFIED Requirements

### Requirement: Unsupported browsers degrade clearly
If the browser can't apply filters to canvas drawing, layers SHALL render without blur, brightness, contrast, saturation or tint, and nothing SHALL break. The Effects popout SHALL say that effects aren't supported in this browser, and its sliders and tint colour SHALL be disabled. Effect values already in the scene SHALL be kept, so they show again in a browser that supports them.

#### Scenario: No canvas filter support
- **WHEN** the editor runs in a browser without canvas filter support
- **THEN** the popout's controls are disabled with a note that effects aren't supported here, and layers with effects render unadjusted without errors

#### Scenario: Values survive
- **WHEN** a scene with blurred and tinted layers is opened in such a browser, autosaved, and then opened in a browser with support
- **THEN** the layers render blurred and tinted again
