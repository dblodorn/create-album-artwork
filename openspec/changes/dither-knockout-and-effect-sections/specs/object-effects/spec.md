# Spec Delta

## ADDED Requirements

### Requirement: Effects grouped into sections
The Effects popout SHALL group its controls into sections, in this order, each framed by a hairline border with square corners:
1. **Blur**
2. **Brightness**, **Contrast** and **Saturation**
3. **Tint**: Strength, colour and Invert
4. **Noise**
5. **Dither**: the Dither switch, Pixel size and Remove white

Each control's Reset SHALL stay with its control, inside its section. For a text layer the popout SHALL show only the Blur section. The note that some effects aren't supported in this browser SHALL still appear when it applies. The border colour SHALL come from the theme, so the sections read in both light and dark mode.

#### Scenario: Five sections for an image
- **WHEN** an image is selected and the person opens Effects
- **THEN** the popout shows five framed sections, in order: Blur; Brightness, Contrast and Saturation; Tint with its colour and Invert; Noise; Dither with Pixel size and Remove white

#### Scenario: One section for text
- **WHEN** a text box is selected and the person opens Effects
- **THEN** the popout shows one framed section, containing Blur

#### Scenario: Both colour modes
- **WHEN** the colour mode is switched between Light and Dark with the Effects popout open
- **THEN** the section borders stay visible in both

## MODIFIED Requirements

### Requirement: Dither for non-text layers
For a selected layer that isn't text, the Effects popout SHALL offer **Dither**, an on/off switch, and a **Pixel size** slider from 1 to 8 artboard units showing its current value, 2 by default. Below Pixel size, on its own row, it SHALL offer **Remove white**, an on/off switch, off by default. Pixel size and Remove white SHALL be disabled while Dither is off, and Remove white SHALL keep its setting while it is disabled.

With Dither on, the layer SHALL render as a 1-bit bitmap in the style of early Macintosh paint programs: every visible pixel black or white, with error-diffusion dithering standing in for the greys. Each bitmap pixel SHALL be a square Pixel size artboard units wide. The pixels SHALL be aligned to the layer, so moving or rotating it keeps the pattern, and scaling it keeps the pixel size on the artboard. Transparent areas SHALL stay transparent, and the layer's opacity, position, size, selection handles and hit area SHALL be unchanged. It SHALL look the same at any zoom and in the 3000 px export.

With Dither and Remove white both on, the white bitmap pixels SHALL become transparent, leaving only the black ones, so the layers and background behind show through. The dithering itself SHALL be unchanged: the same pixels SHALL be black as with Remove white off. Remove white SHALL have no effect while Dither is off.

Dither SHALL combine with the other effects in this order:
- Brightness, Contrast and Saturation apply first, so they set how much of the layer turns black or white (raising Brightness turns more pixels white, which Remove white then clears).
- Noise applies before dithering, so it roughens the bitmap.
- Remove white applies to the bitmap, before Tint.
- Tint applies after dithering, colouring the white pixels and keeping the black ones black; with Invert on it colours the black pixels instead. With Remove white on there are no white pixels, so only an inverted tint changes the layer's colour.
- Blur applies last, softening the bitmap.

Turning Dither on or off SHALL be one undo step named "Dither". One Pixel size drag SHALL be one undo step named "Pixel size". Turning Remove white on or off SHALL apply at once and SHALL be one undo step named "Remove white". For a text layer the popout SHALL NOT show Dither, Pixel size or Remove white.

#### Scenario: Bitmap an image
- **WHEN** an image is selected and the person opens Effects and turns Dither on
- **THEN** the image renders in black and white pixels only, with dithered greys, and the Edit menu offers "Undo Dither"

#### Scenario: Chunkier pixels
- **WHEN** a dithered image has Pixel size raised from 2 to 6
- **THEN** its bitmap pixels become three times as wide, and the popout shows 6

#### Scenario: Pixel size needs Dither
- **WHEN** a layer with Dither off is selected and the person opens Effects
- **THEN** the Pixel size slider is disabled

#### Scenario: Remove the white
- **WHEN** a dithered image renders as a black subject on white over a red artboard background, and the person turns Remove white on
- **THEN** the white pixels become transparent, so the subject's black pixels show over red, and the Edit menu offers "Undo Remove white"

#### Scenario: Remove white undo
- **WHEN** the person turns Remove white on and then undoes once
- **THEN** Remove white is off and the white pixels are opaque again

#### Scenario: Remove white needs Dither
- **WHEN** a layer with Dither off is selected and the person opens Effects
- **THEN** the Remove white switch is disabled; turning Dither on enables it

#### Scenario: Kept while Dither is off
- **WHEN** a dithered layer has Remove white on, and the person turns Dither off and on again
- **THEN** Remove white is still on and the white pixels are transparent again

#### Scenario: Coloured dots
- **WHEN** a dithered image has Remove white on and Tint 100% in red with Invert on
- **THEN** its remaining pixels render red, with transparency where the white was

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
- **THEN** the popout shows neither Noise nor Dither nor Pixel size nor Remove white

### Requirement: Reset each control
Each control in the Effects popout (Blur, Brightness, Contrast, Saturation, Tint, Noise, Dither and Pixel size) SHALL have its own **Reset**, which SHALL return only that control to its neutral value as one undo step named after the control. The neutral values SHALL be 0 for Blur, Brightness, Contrast, Saturation and Noise, 0% Strength with Invert off for Tint, off with Remove white off for Dither, and 2 for Pixel size. A control's Reset SHALL be disabled while the control is at its neutral value (for Tint, Strength 0% with Invert off; for Dither, Dither off with Remove white off), and Pixel size's Reset SHALL also be disabled while Dither is off. Resetting Tint SHALL turn Invert off within the same one "Tint" step and SHALL keep the chosen tint colour. Resetting Dither SHALL turn Remove white off within the same one "Dither" step and SHALL keep the chosen Pixel size. Resetting Pixel size SHALL leave Remove white as it is.

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

#### Scenario: Reset Dither turns Remove white off
- **WHEN** a layer has Dither on with Remove white on, and the person clicks Dither's Reset and then undoes once
- **THEN** after the Reset Dither and Remove white are both off; after the undo both are on again

#### Scenario: Remove white alone keeps Dither's Reset enabled
- **WHEN** a layer has Dither off but Remove white still on from earlier
- **THEN** Dither's Reset is enabled, and clicking it turns Remove white off

#### Scenario: Neutral controls
- **WHEN** a layer with no effects is selected and the person opens Effects
- **THEN** every Reset in the popout is disabled

### Requirement: Noise and dither persist and export
A layer's Noise, Dither, Pixel size and Remove white SHALL be saved with the scene. They SHALL survive a page reload and a JSON export followed by a JSON load, SHALL appear in the PNG export as they look on the canvas, and SHALL be undone and redone with the rest of the object's properties. Copies made by paste SHALL keep them. A scene saved without them SHALL load with Noise 0, Dither off, Pixel size 2 and Remove white off.

#### Scenario: Reload keeps them
- **WHEN** an image has Noise 20, Dither on, Pixel size 4 and Remove white on, and the page is reloaded
- **THEN** the image still renders grainy and dithered at that pixel size with its white removed, and the popout shows the same values

#### Scenario: Export
- **WHEN** a dithered layer is exported as a PNG
- **THEN** the export shows the same bitmap, with pixels scaled to the 3000 px size

#### Scenario: Export with Remove white
- **WHEN** a dithered layer with Remove white on sits over a coloured background and is exported as a PNG
- **THEN** the background colour shows through where the white pixels were, as on the canvas

#### Scenario: Paste keeps them
- **WHEN** a dithered layer with noise and Remove white on is copied and pasted
- **THEN** the copy has the same Noise, Dither, Pixel size and Remove white

#### Scenario: Older scene
- **WHEN** the person loads a JSON scene saved before this change
- **THEN** every layer renders as before, with Noise 0, Dither off and Remove white off

### Requirement: Unsupported browsers degrade clearly
If the browser can't apply filters to canvas drawing, layers SHALL render without blur, brightness, contrast, saturation or tint, and nothing SHALL break. The Effects popout SHALL say that those effects aren't supported in this browser, and their sliders, the tint colour and Tint's Invert switch SHALL be disabled. Noise, Dither, Pixel size and Remove white SHALL NOT depend on canvas filters: in such a browser they SHALL stay enabled and SHALL render. Effect values already in the scene SHALL be kept, so they show again in a browser that supports them.

#### Scenario: No canvas filter support
- **WHEN** the editor runs in a browser without canvas filter support
- **THEN** the Blur, Brightness, Contrast, Saturation and Tint controls, including Invert, are disabled with a note that they aren't supported here, and layers with those effects render unadjusted without errors

#### Scenario: Noise and dither still work
- **WHEN** the editor runs in a browser without canvas filter support and the person turns Dither on for an image and drags Noise to 30
- **THEN** the image renders as a grainy black-and-white bitmap, and both controls are enabled

#### Scenario: Remove white still works
- **WHEN** the editor runs in a browser without canvas filter support and the person turns Remove white on for a dithered image
- **THEN** the white pixels become transparent, and the switch is enabled

#### Scenario: Values survive
- **WHEN** a scene with blurred, tinted and invert-tinted layers is opened in such a browser, autosaved, and then opened in a browser with support
- **THEN** the layers render blurred and tinted again, with inverted tints still inverted
