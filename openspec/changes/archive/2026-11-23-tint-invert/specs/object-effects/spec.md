# Spec Delta

## MODIFIED Requirements

### Requirement: Unsupported browsers degrade clearly
If the browser can't apply filters to canvas drawing, layers SHALL render without blur, brightness, contrast, saturation or tint, and nothing SHALL break. The Effects popout SHALL say that those effects aren't supported in this browser, and their sliders, the tint colour and Tint's Invert switch SHALL be disabled. Noise, Dither and Pixel size SHALL NOT depend on canvas filters: in such a browser they SHALL stay enabled and SHALL render. Effect values already in the scene SHALL be kept, so they show again in a browser that supports them.

#### Scenario: No canvas filter support
- **WHEN** the editor runs in a browser without canvas filter support
- **THEN** the Blur, Brightness, Contrast, Saturation and Tint controls, including Invert, are disabled with a note that they aren't supported here, and layers with those effects render unadjusted without errors

#### Scenario: Noise and dither still work
- **WHEN** the editor runs in a browser without canvas filter support and the person turns Dither on for an image and drags Noise to 30
- **THEN** the image renders as a grainy black-and-white bitmap, and both controls are enabled

#### Scenario: Values survive
- **WHEN** a scene with blurred, tinted and invert-tinted layers is opened in such a browser, autosaved, and then opened in a browser with support
- **THEN** the layers render blurred and tinted again, with inverted tints still inverted

### Requirement: Colour adjustments for non-text layers
For a selected layer that isn't text (an image, a drawing or a shape), the Effects popout SHALL offer, below Blur:
- **Brightness**, **Contrast** and **Saturation**, each a slider from −100 to +100 showing its current value, with 0 meaning unchanged;
- **Tint**, a colour plus a **Strength** slider from 0% to 100% showing its current value, with 0% meaning no tint, and an **Invert** on/off switch on its own row below the colour, off by default.

Their effect on the layer SHALL be:
- Brightness +100 makes the layer twice as bright and −100 makes it black.
- Contrast +100 doubles the contrast and −100 makes the layer flat mid-grey.
- Saturation +100 doubles the saturation and −100 makes the layer greyscale.
- Tint colours the layer's visible pixels towards the chosen colour by Strength, keeping their light and dark (100% is the layer's shading in that colour: white becomes the colour and black stays black). Transparent areas SHALL stay transparent.
- With **Invert** on, Tint SHALL put the colour at the dark end instead: at 100%, black becomes the chosen colour and white stays white, and the tones between run from the colour (darkest) to white (lightest). Strength SHALL mix it in the same way. Invert SHALL apply whether or not Dither is on.

The adjustments SHALL combine with each other and with Blur on the same layer. They SHALL keep the layer's opacity, position, size, selection handles and hit area unchanged, and SHALL look the same at any zoom.

Moving a slider SHALL update the canvas live, and one drag SHALL be one undo step named after the control: "Brightness", "Contrast", "Saturation" or "Tint" (a Strength drag is a "Tint" step). Choosing a tint colour SHALL be one "Tint" step and SHALL apply at once; choosing a colour while Strength is 0% SHALL keep the colour for when Strength is raised. Turning Invert on or off SHALL apply at once and SHALL be one undo step named "Tint invert". Invert SHALL be disabled while Strength is 0% and while freehand drawing is on; its setting SHALL be kept while it is disabled.

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

#### Scenario: Invert a dithered drawing
- **WHEN** an image with Dither on renders as a black subject on white, and the person sets a red tint at 100% and turns Invert on
- **THEN** the subject renders red on white, the area around the image stays transparent, and the Edit menu offers "Undo Tint invert"

#### Scenario: Invert without dither
- **WHEN** a greyscale image with Tint 100% in blue has Invert turned on
- **THEN** its darkest areas render blue, its lightest areas white, and the mid-tones light blue

#### Scenario: Invert undo
- **WHEN** the person turns Invert on and then undoes once
- **THEN** Invert is off and the layer renders with the ordinary tint again

#### Scenario: Invert needs strength
- **WHEN** a layer has Tint Strength 0%
- **THEN** the Invert switch is disabled, and raising Strength enables it

#### Scenario: One drag, one undo
- **WHEN** the person drags Contrast from 0 through several values to 30 and then undoes once
- **THEN** contrast is back to 0

#### Scenario: Combined with blur
- **WHEN** an image has Blur 10, Brightness 20 and Tint 50%
- **THEN** it renders blurred, brighter and tinted at the same time

#### Scenario: Text shows Blur only
- **WHEN** a text box is selected and the person opens Effects
- **THEN** the popout shows Blur and none of Brightness, Contrast, Saturation or Tint, nor Invert

### Requirement: Reset each control
Each control in the Effects popout (Blur, Brightness, Contrast, Saturation, Tint, Noise, Dither and Pixel size) SHALL have its own **Reset**, which SHALL return only that control to its neutral value as one undo step named after the control. The neutral values SHALL be 0 for Blur, Brightness, Contrast, Saturation and Noise, 0% Strength with Invert off for Tint, off for Dither and 2 for Pixel size. A control's Reset SHALL be disabled while the control is at its neutral value (for Tint, Strength 0% with Invert off), and Pixel size's Reset SHALL also be disabled while Dither is off. Resetting Tint SHALL turn Invert off within the same one "Tint" step and SHALL keep the chosen tint colour, and resetting Dither SHALL keep the chosen Pixel size.

#### Scenario: Reset one control
- **WHEN** an image has Brightness 30 and Saturation −50 and the person clicks Brightness's Reset
- **THEN** Brightness is 0 and its Reset is disabled, and Saturation is still −50

#### Scenario: Reset is undoable
- **WHEN** the person resets Tint from 60% and then undoes
- **THEN** Tint Strength is 60% again, with the same colour

#### Scenario: Reset Tint turns Invert off
- **WHEN** a layer has Tint 80% in red with Invert on, and the person clicks Tint's Reset and then undoes once
- **THEN** after the Reset Tint is 0% with Invert off and the colour still red; after the undo it is 80% with Invert on again

#### Scenario: Reset Dither keeps Pixel size
- **WHEN** a layer has Dither on with Pixel size 5 and the person clicks Dither's Reset
- **THEN** Dither is off, and turning it on again uses Pixel size 5

#### Scenario: Neutral controls
- **WHEN** a layer with no effects is selected and the person opens Effects
- **THEN** every Reset in the popout is disabled

### Requirement: Colour adjustments persist and export
A layer's brightness, contrast, saturation, tint colour, tint strength and tint Invert SHALL be saved with the scene. They SHALL survive a page reload and a JSON export followed by a JSON load, SHALL appear in the PNG export as they look on the canvas, and SHALL be undone and redone with the rest of the object's properties. Copies made by paste SHALL keep the adjustments. A scene saved without them SHALL load with every adjustment at its neutral value.

#### Scenario: Reload keeps adjustments
- **WHEN** an image has Contrast 25 and Tint 40% in blue with Invert on, and the page is reloaded
- **THEN** the image still renders with them, and the popout shows Contrast 25 and Tint 40% in blue with Invert on

#### Scenario: Export
- **WHEN** a layer has colour adjustments and the person exports a PNG
- **THEN** the export shows the layer adjusted as on the canvas

#### Scenario: Pasted copy keeps Invert
- **WHEN** a layer with an inverted tint is copied and pasted
- **THEN** the copy renders with the same inverted tint and its popout shows Invert on

#### Scenario: Older scene
- **WHEN** the person loads a JSON scene saved before this change
- **THEN** every layer renders as before, and its adjustments read as neutral, with Invert off
