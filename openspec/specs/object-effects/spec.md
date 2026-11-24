# object-effects Specification

## Purpose

Lets someone apply visual effects to a single layer from the Layers panel's Effects popout: a Gaussian-style blur on every kind of layer, plus brightness, contrast, saturation, a colour tint, noise and a 1-bit old-Mac-style dither on layers that aren't text. Each control resets on its own, and the effects stay with the scene and its export.

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

### Requirement: Noise for non-text layers
For a selected layer that isn't text (an image, a drawing or a shape), the Effects popout SHALL offer **Noise**, a slider from 0 (off) to 100 showing its current value. Noise SHALL add monochrome grain to the layer's visible pixels, stronger as the value rises. Transparent areas SHALL stay transparent, and the layer's opacity, position, size, selection handles and hit area SHALL be unchanged.

The grain SHALL be stable: it SHALL NOT change when the canvas redraws, when the layer is selected or moved, or when the scene is reloaded. Its grain size SHALL be in artboard units, so it looks the same at any zoom and in the 3000 px export. Noise SHALL work with or without Dither.

Moving the slider SHALL update the canvas live, and one drag SHALL be one undo step named "Noise". For a text layer the popout SHALL NOT show Noise.

#### Scenario: Add grain to an image
- **WHEN** an image is selected and the person opens Effects and drags Noise to 40
- **THEN** the image renders grainy as the slider moves, the popout shows 40, and the Edit menu offers "Undo Noise"

#### Scenario: Grain doesn't shimmer
- **WHEN** a shape has Noise 50 and the person moves it, deselects it and reloads the page
- **THEN** the grain pattern on the shape is the same throughout

#### Scenario: Same at any zoom
- **WHEN** a layer has Noise 30 and the person zooms from 50% to 200%
- **THEN** the grain scales with the layer instead of staying a fixed screen size

#### Scenario: One drag, one undo
- **WHEN** the person drags Noise from 0 through several values to 60 and then undoes once
- **THEN** Noise is back to 0

### Requirement: Dither for non-text layers
For a selected layer that isn't text, the Effects popout SHALL offer **Dither**, an on/off switch, and a **Pixel size** slider from 1 to 8 artboard units showing its current value, 2 by default. Pixel size SHALL be disabled while Dither is off.

With Dither on, the layer SHALL render as a 1-bit bitmap in the style of early Macintosh paint programs: every visible pixel black or white, with error-diffusion dithering standing in for the greys. Each bitmap pixel SHALL be a square Pixel size artboard units wide. The pixels SHALL be aligned to the layer, so moving or rotating it keeps the pattern, and scaling it keeps the pixel size on the artboard. Transparent areas SHALL stay transparent, and the layer's opacity, position, size, selection handles and hit area SHALL be unchanged. It SHALL look the same at any zoom and in the 3000 px export.

Dither SHALL combine with the other effects in this order:
- Brightness, Contrast and Saturation apply first, so they set how much of the layer turns black or white (raising Brightness turns more pixels white).
- Noise applies before dithering, so it roughens the bitmap.
- Tint applies after dithering, colouring the white pixels and keeping the black ones black.
- Blur applies last, softening the bitmap.

Turning Dither on or off SHALL be one undo step named "Dither". One Pixel size drag SHALL be one undo step named "Pixel size". For a text layer the popout SHALL NOT show Dither or Pixel size.

#### Scenario: Bitmap an image
- **WHEN** an image is selected and the person opens Effects and turns Dither on
- **THEN** the image renders in black and white pixels only, with dithered greys, and the Edit menu offers "Undo Dither"

#### Scenario: Chunkier pixels
- **WHEN** a dithered image has Pixel size raised from 2 to 6
- **THEN** its bitmap pixels become three times as wide, and the popout shows 6

#### Scenario: Pixel size needs Dither
- **WHEN** a layer with Dither off is selected and the person opens Effects
- **THEN** the Pixel size slider is disabled

#### Scenario: Brightness as threshold
- **WHEN** a dithered image has Brightness raised from 0 to 50
- **THEN** more of its pixels render white

#### Scenario: Tinted paper
- **WHEN** a dithered shape has Tint 100% in blue
- **THEN** its pixels render blue and black only

#### Scenario: Move keeps the pattern
- **WHEN** a dithered image is moved across the artboard
- **THEN** its bitmap pattern moves with it unchanged

#### Scenario: Text shows neither
- **WHEN** a text box is selected and the person opens Effects
- **THEN** the popout shows neither Noise nor Dither nor Pixel size

### Requirement: Noise and dither persist and export
A layer's Noise, Dither and Pixel size SHALL be saved with the scene. They SHALL survive a page reload and a JSON export followed by a JSON load, SHALL appear in the PNG export as they look on the canvas, and SHALL be undone and redone with the rest of the object's properties. Copies made by paste SHALL keep them. A scene saved without them SHALL load with Noise 0, Dither off and Pixel size 2.

#### Scenario: Reload keeps them
- **WHEN** an image has Noise 20, Dither on and Pixel size 4, and the page is reloaded
- **THEN** the image still renders grainy and dithered at that pixel size, and the popout shows the same values

#### Scenario: Export
- **WHEN** a dithered layer is exported as a PNG
- **THEN** the export shows the same bitmap, with pixels scaled to the 3000 px size

#### Scenario: Paste keeps them
- **WHEN** a dithered layer with noise is copied and pasted
- **THEN** the copy has the same Noise, Dither and Pixel size

#### Scenario: Older scene
- **WHEN** the person loads a JSON scene saved before this change
- **THEN** every layer renders as before, with Noise 0 and Dither off
