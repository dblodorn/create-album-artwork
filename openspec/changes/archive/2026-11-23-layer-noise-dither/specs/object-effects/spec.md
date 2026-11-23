# Spec Delta

## ADDED Requirements

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

## MODIFIED Requirements

### Requirement: Unsupported browsers degrade clearly
If the browser can't apply filters to canvas drawing, layers SHALL render without blur, brightness, contrast, saturation or tint, and nothing SHALL break. The Effects popout SHALL say that those effects aren't supported in this browser, and their sliders and the tint colour SHALL be disabled. Noise, Dither and Pixel size SHALL NOT depend on canvas filters: in such a browser they SHALL stay enabled and SHALL render. Effect values already in the scene SHALL be kept, so they show again in a browser that supports them.

#### Scenario: No canvas filter support
- **WHEN** the editor runs in a browser without canvas filter support
- **THEN** the Blur, Brightness, Contrast, Saturation and Tint controls are disabled with a note that they aren't supported here, and layers with those effects render unadjusted without errors

#### Scenario: Noise and dither still work
- **WHEN** the editor runs in a browser without canvas filter support and the person turns Dither on for an image and drags Noise to 30
- **THEN** the image renders as a grainy black-and-white bitmap, and both controls are enabled

#### Scenario: Values survive
- **WHEN** a scene with blurred and tinted layers is opened in such a browser, autosaved, and then opened in a browser with support
- **THEN** the layers render blurred and tinted again

### Requirement: Reset each control
Each control in the Effects popout (Blur, Brightness, Contrast, Saturation, Tint, Noise, Dither and Pixel size) SHALL have its own **Reset**, which SHALL return only that control to its neutral value as one undo step named after the control. The neutral values SHALL be 0 for Blur, Brightness, Contrast, Saturation and Noise, 0% Strength for Tint, off for Dither and 2 for Pixel size. A control's Reset SHALL be disabled while the control is at its neutral value, and Pixel size's Reset SHALL also be disabled while Dither is off. Resetting Tint SHALL keep the chosen tint colour, and resetting Dither SHALL keep the chosen Pixel size.

#### Scenario: Reset one control
- **WHEN** an image has Brightness 30 and Saturation −50 and the person clicks Brightness's Reset
- **THEN** Brightness is 0 and its Reset is disabled, and Saturation is still −50

#### Scenario: Reset is undoable
- **WHEN** the person resets Tint from 60% and then undoes
- **THEN** Tint Strength is 60% again, with the same colour

#### Scenario: Reset Dither keeps Pixel size
- **WHEN** a layer has Dither on with Pixel size 5 and the person clicks Dither's Reset
- **THEN** Dither is off, and turning it on again uses Pixel size 5

#### Scenario: Neutral controls
- **WHEN** a layer with no effects is selected and the person opens Effects
- **THEN** every Reset in the popout is disabled
