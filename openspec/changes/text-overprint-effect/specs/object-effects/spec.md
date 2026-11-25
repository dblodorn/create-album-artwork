# Spec Delta

## ADDED Requirements

### Requirement: Overprint for text layers
For a selected text layer, the Effects popout SHALL offer **Overprint**, below Blur, with two sliders, each showing its current value:
- **Deterioration**, from 0 (off) to 0.15, measured as a fraction of the text's font size;
- **Overprint**, from 2 to 98, 67 by default.

With Deterioration above 0, the text SHALL render as if the letters were blurred by Deterioration × font size and then cut back to a hard edge. Pixels below the Overprint threshold SHALL become fully transparent and those above it fully opaque, so no blur remains visible. Raising Overprint SHALL make the letters bolder, and lowering it SHALL make them thinner. Raising Deterioration SHALL round corners and fill in or wear away more of each letter. Overprint SHALL apply to every letter and line in the text box, together.

The effect SHALL keep:
- the text's own colours, including different colours on different characters;
- the layer's opacity;
- the layer's position, size, selection handles and hit area.

Letters made bolder SHALL NOT be clipped at the text box's edges. A text shadow SHALL follow the overprinted letter shapes. The result SHALL be the same on every redraw, with nothing random. It SHALL scale with the text: scaling the layer or changing its font size keeps the same look relative to the letters. It SHALL look the same at any zoom and in the 3000 px export, and moving or rotating the layer SHALL keep it unchanged. The text SHALL stay editable with the effect on, and the effect SHALL stay applied while it is edited.

Moving a slider SHALL update the canvas live. One drag SHALL be one undo step, named "Deterioration" or "Overprint". The Overprint slider SHALL be disabled while Deterioration is 0, and SHALL keep its value while disabled. Overprint SHALL combine with Blur: Blur applies after Overprint, softening its hard edges.

For a layer that isn't text, the popout SHALL NOT show Overprint.

#### Scenario: Wear the text
- **WHEN** a text box is selected and the person opens Effects and drags Deterioration to 0.06
- **THEN** the letters render with rounded, ink-spread edges as the slider moves, the popout shows 0.06, and the Edit menu offers "Undo Deterioration"

#### Scenario: Bolder and thinner
- **WHEN** a text box has Deterioration 0.06 and the person raises Overprint from 67 to 85, then lowers it to 40
- **THEN** the letters grow bolder at 85, and at 40 they are thinner than at 67

#### Scenario: Hard edges, same colour
- **WHEN** red text has Deterioration 0.08
- **THEN** the letters render solid red with hard edges, no blurred halo, and transparent space around them

#### Scenario: Overprint needs Deterioration
- **WHEN** a text box with Deterioration 0 is selected and the person opens Effects
- **THEN** the Overprint slider is disabled, and raising Deterioration enables it

#### Scenario: One drag, one undo
- **WHEN** the person drags Overprint from 67 through several values to 80 and then undoes once
- **THEN** Overprint is back to 67

#### Scenario: Scales with the text
- **WHEN** a text box with Deterioration 0.06 is scaled to twice its size
- **THEN** the letters keep the same worn shapes, twice as large

#### Scenario: Same at any zoom
- **WHEN** a text box has Deterioration 0.06 and the person zooms from 50% to 200%
- **THEN** the letter shapes look the same, only larger

#### Scenario: Edit worn text
- **WHEN** a text box with Deterioration 0.06 is double-clicked and the person types more letters
- **THEN** the new letters render worn like the others, and the text cursor stays visible

#### Scenario: Combined with blur
- **WHEN** a text box has Deterioration 0.06 and Blur 4
- **THEN** it renders with the worn letter shapes, softened by the blur

#### Scenario: Not offered on images
- **WHEN** an image is selected and the person opens Effects
- **THEN** the popout shows no Overprint section

### Requirement: Overprint persists and exports
A text layer's Deterioration and Overprint SHALL be saved with the scene. They SHALL survive a page reload and a JSON export followed by a JSON load, SHALL appear in the PNG export as they look on the canvas, and SHALL be undone and redone with the rest of the object's properties. Copies made by paste SHALL keep them. A scene saved without them SHALL load with Deterioration 0 and Overprint 67.

#### Scenario: Reload keeps them
- **WHEN** a text box has Deterioration 0.05 and Overprint 75, and the page is reloaded
- **THEN** the text still renders worn, and the popout shows Deterioration 0.05 and Overprint 75

#### Scenario: Export
- **WHEN** a text box with Overprint is exported as a PNG
- **THEN** the export shows the same worn letters, scaled to the 3000 px size

#### Scenario: Paste keeps them
- **WHEN** a worn text box is copied and pasted
- **THEN** the copy has the same Deterioration and Overprint

#### Scenario: Older scene
- **WHEN** the person loads a JSON scene saved before this change
- **THEN** every text layer renders as before, with Deterioration 0 and Overprint 67

## MODIFIED Requirements

### Requirement: Unsupported browsers degrade clearly
If the browser can't apply filters to canvas drawing, layers SHALL render without blur, brightness, contrast, saturation or tint, and nothing SHALL break. The Effects popout SHALL say that those effects aren't supported in this browser, and their sliders, the tint colour and Tint's Invert switch SHALL be disabled. Noise, Dither, Pixel size, Remove white, Deterioration and Overprint SHALL NOT depend on canvas filters: in such a browser they SHALL stay enabled and SHALL render. Effect values already in the scene SHALL be kept, so they show again in a browser that supports them.

#### Scenario: No canvas filter support
- **WHEN** the editor runs in a browser without canvas filter support
- **THEN** the Blur, Brightness, Contrast, Saturation and Tint controls, including Invert, are disabled with a note that they aren't supported here, and layers with those effects render unadjusted without errors

#### Scenario: Noise and dither still work
- **WHEN** the editor runs in a browser without canvas filter support and the person turns Dither on for an image and drags Noise to 30
- **THEN** the image renders as a grainy black-and-white bitmap, and both controls are enabled

#### Scenario: Remove white still works
- **WHEN** the editor runs in a browser without canvas filter support and the person turns Remove white on for a dithered image
- **THEN** the white pixels become transparent, and the switch is enabled

#### Scenario: Overprint still works
- **WHEN** the editor runs in a browser without canvas filter support and the person drags Deterioration to 0.06 on a text box
- **THEN** the letters render worn with hard edges, and the Deterioration and Overprint sliders are enabled

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

For a text layer the popout SHALL show Blur and Overprint only.

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
- **THEN** the popout shows Blur and Overprint, and none of Brightness, Contrast, Saturation or Tint, nor Invert

### Requirement: Reset each control
Each control in the Effects popout (Blur, Deterioration, Overprint, Brightness, Contrast, Saturation, Tint, Noise, Dither and Pixel size) SHALL have its own **Reset**, which SHALL return only that control to its neutral value as one undo step named after the control. The neutral values SHALL be 0 for Blur, Deterioration, Brightness, Contrast, Saturation and Noise, 67 for Overprint, 0% Strength with Invert off for Tint, off with Remove white off for Dither, and 2 for Pixel size. A control's Reset SHALL be disabled while the control is at its neutral value (for Tint, Strength 0% with Invert off; for Dither, Dither off with Remove white off). Pixel size's Reset SHALL also be disabled while Dither is off, and Overprint's Reset SHALL also be disabled while Deterioration is 0. Resetting Tint SHALL turn Invert off within the same one "Tint" step and SHALL keep the chosen tint colour. Resetting Dither SHALL turn Remove white off within the same one "Dither" step and SHALL keep the chosen Pixel size. Resetting Pixel size SHALL leave Remove white as it is. Resetting Deterioration SHALL keep the chosen Overprint.

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

#### Scenario: Reset Deterioration keeps Overprint
- **WHEN** a text box has Deterioration 0.06 and Overprint 80, and the person clicks Deterioration's Reset
- **THEN** Deterioration is 0, the text renders plain, Overprint's slider and Reset are disabled, and raising Deterioration again uses Overprint 80

#### Scenario: Reset Overprint
- **WHEN** a text box has Deterioration 0.06 and Overprint 85, and the person clicks Overprint's Reset
- **THEN** Overprint is 67 and its Reset is disabled, and the Edit menu offers "Undo Overprint"

#### Scenario: Neutral controls
- **WHEN** a layer with no effects is selected and the person opens Effects
- **THEN** every Reset in the popout is disabled

### Requirement: Effects grouped into sections
The Effects popout SHALL group its controls into sections, each framed by a hairline border with square corners. For a layer that isn't text the sections SHALL be, in this order:
1. **Blur**
2. **Brightness**, **Contrast** and **Saturation**
3. **Tint**: Strength, colour and Invert
4. **Noise**
5. **Dither**: the Dither switch, Pixel size and Remove white

For a text layer the popout SHALL show only these sections, in this order:
1. **Blur**
2. **Overprint**: Deterioration and Overprint

Each control's Reset SHALL stay with its control, inside its section. The note that some effects aren't supported in this browser SHALL still appear when it applies. The border colour SHALL come from the theme, so the sections read in both light and dark mode.

#### Scenario: Five sections for an image
- **WHEN** an image is selected and the person opens Effects
- **THEN** the popout shows five framed sections, in order: Blur; Brightness, Contrast and Saturation; Tint with its colour and Invert; Noise; Dither with Pixel size and Remove white

#### Scenario: One section for text
- **WHEN** a text box is selected and the person opens Effects
- **THEN** the popout shows two framed sections, in order: Blur; Overprint with Deterioration and Overprint

#### Scenario: Both colour modes
- **WHEN** the colour mode is switched between Light and Dark with the Effects popout open
- **THEN** the section borders stay visible in both
