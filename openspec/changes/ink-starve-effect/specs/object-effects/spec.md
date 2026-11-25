# Spec Delta

## ADDED Requirements

### Requirement: Ink starve for text and image layers
For a selected text layer or image layer, the Effects popout SHALL offer **Ink starve**. It SHALL appear in its own section (see "Effects grouped into sections"), with these sliders, each showing its current value:
- **Ink starve**, from 0 (off) to 100: how dry the roller is;
- **Softness**, from 0 to 50, 13 by default: how gradually solid ink turns to spray;
- **Roller**, from 0 to 100, 55 by default: how strongly the ink falls off along the roller;
- **Roller angle**, from 0° to 359°, 14° by default: the direction in which the ink runs dry;
- **Blob size**, from 2 to 50, 12 by default: the size of the patches of more and less ink, as a percentage of the layer's longer side;
- **Spray**, from 0 to 100, 22 by default: how much overspray lands just past the edges;
- **Nicks**, from 0 to 100, 25 by default: how often small voids are cut out of the solid ink;
- **Seed**, from 1 to 100, 1 by default: which pattern is drawn. Each value gives a different pattern with the same character.

With Ink starve above 0, the layer SHALL render as if printed by a roller running out of ink:
- it stays solid where the ink held, and breaks into soft patches and fine spray where it ran out;
- small nicks appear in the solid ink;
- a scatter of spray falls just outside the edges where the ink is fading.

Raising Ink starve SHALL leave less ink. Raising Roller SHALL make the side the roller angle points towards drier than the opposite side. Raising Softness SHALL widen the band between solid and spray. Raising Spray SHALL scatter more overspray past the edges, and Spray 0 SHALL leave none. Nicks 0 SHALL cut no nicks.

Where the ink is starved, the layer SHALL become transparent, showing whatever is behind it. Ink that remains SHALL keep the layer's own colours:
- the text's colours, including different colours on different characters;
- an image's pixels.

Spray SHALL take the colour of the layer near it. The effect SHALL keep:
- the layer's opacity;
- the layer's position, size, selection handles and hit area.

A text shadow SHALL follow the starved letters.

The pattern SHALL be the same on every redraw for the same settings, with nothing random from one redraw to the next. It SHALL belong to the layer:
- moving or rotating the layer SHALL leave it unchanged;
- scaling the layer SHALL scale it with the layer;
- it SHALL look the same at any zoom and in the 3000 px export, apart from resolution.

Two layers with the same settings but different Seeds SHALL starve differently. Text SHALL stay editable with the effect on, and new letters SHALL render starved like the others.

Moving a slider SHALL update the canvas live, and one drag SHALL be one undo step named after the slider. Every slider but Ink starve SHALL be disabled while Ink starve is 0, and SHALL keep its value while disabled.

Ink starve SHALL combine with the other effects:
- On text, it SHALL apply after Overprint, so worn letters are then starved.
- On an image, it SHALL apply after the colour adjustments, Noise, Dither and Tint.
- On either, Blur SHALL apply after Ink starve, softening it.

For a shape or a drawing, the popout SHALL NOT show Ink starve.

#### Scenario: Starve the text
- **WHEN** a text box is selected and the person opens Effects and drags Ink starve to 40
- **THEN** the letters break into patches and spray as the slider moves, the popout shows 40, and the Edit menu offers "Undo Ink starve"

#### Scenario: More starve, less ink
- **WHEN** a text box has Ink starve 30 and the person raises it to 70
- **THEN** less of the letters is inked at 70 than at 30

#### Scenario: The roller runs dry on one side
- **WHEN** a wide text box has Ink starve 40, Roller 80 and Roller angle 0°
- **THEN** the right-hand side of the text has less ink than the left-hand side

#### Scenario: Starve an image
- **WHEN** an opaque photo is selected and the person drags Ink starve to 50
- **THEN** parts of the photo become transparent in patches and speckle, and the remaining pixels keep the photo's colours

#### Scenario: Controls need Ink starve
- **WHEN** a layer with Ink starve 0 is selected and the person opens Effects
- **THEN** Softness, Roller, Roller angle, Blob size, Spray, Nicks and Seed are disabled, and raising Ink starve enables them

#### Scenario: Seed changes the pattern
- **WHEN** a text box has Ink starve 40 and the person changes Seed from 1 to 2
- **THEN** the text starves in a different pattern with the same overall amount of ink, and the Edit menu offers "Undo Seed"

#### Scenario: No spray
- **WHEN** a text box has Ink starve 40 and Spray 0
- **THEN** no ink lands outside the letters

#### Scenario: Same pattern after moving and zooming
- **WHEN** a starved text box is moved, rotated, and the view is zoomed from 50% to 200%
- **THEN** the starved pattern on the letters is the same throughout, only moved, turned and larger

#### Scenario: Scales with the layer
- **WHEN** a starved image is scaled to twice its size
- **THEN** it keeps the same pattern, twice as large

#### Scenario: Combined with Overprint
- **WHEN** a text box has Deterioration 0.06 and Ink starve 40
- **THEN** the letters render with worn, rounded shapes that are then starved into patches and spray

#### Scenario: Not offered on shapes
- **WHEN** a rectangle is selected and the person opens Effects
- **THEN** the popout shows no Ink starve section

### Requirement: Ink starve persists and exports
A layer's Ink starve settings (Ink starve, Softness, Roller, Roller angle, Blob size, Spray, Nicks and Seed) SHALL be saved with the scene. They SHALL:
- survive a page reload, and a JSON export followed by a JSON load;
- appear in the PNG export as they look on the canvas;
- be undone and redone with the rest of the object's properties.

Copies made by paste SHALL keep them. Merge and Rasterize SHALL bake the starved look into the new image, spray included, without clipping it. A scene saved without them SHALL load with Ink starve off and every other Ink starve control at its default.

#### Scenario: Reload keeps them
- **WHEN** a text box has Ink starve 45, Roller angle 90° and Seed 7, and the page is reloaded
- **THEN** it renders with the same starved pattern, and the popout shows Ink starve 45, Roller angle 90° and Seed 7

#### Scenario: Export
- **WHEN** a starved image is exported as a PNG
- **THEN** the export shows the same starved pattern, scaled to the 3000 px size

#### Scenario: Paste keeps them
- **WHEN** a starved text box is copied and pasted
- **THEN** the copy has the same Ink starve settings and starves in the same pattern

#### Scenario: Rasterize keeps the spray
- **WHEN** a starved text box with Spray 60 is rasterized
- **THEN** the new image shows the same starved letters, with the spray past their edges intact

#### Scenario: Older scene
- **WHEN** the person loads a JSON scene saved before this change
- **THEN** every layer renders as before, with Ink starve 0

## MODIFIED Requirements

### Requirement: Unsupported browsers degrade clearly
If the browser can't apply filters to canvas drawing, layers SHALL render without blur, brightness, contrast, saturation or tint, and nothing SHALL break. The Effects popout SHALL say that those effects aren't supported in this browser, and their sliders, the tint colour and Tint's Invert switch SHALL be disabled. Noise, Dither, Pixel size, Remove white, Deterioration, Overprint and every Ink starve control SHALL NOT depend on canvas filters: in such a browser they SHALL stay enabled and SHALL render. Effect values already in the scene SHALL be kept, so they show again in a browser that supports them.

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

#### Scenario: Ink starve still works
- **WHEN** the editor runs in a browser without canvas filter support and the person drags Ink starve to 40 on a text box
- **THEN** the letters render starved into patches and spray, and every Ink starve control is enabled

### Requirement: Reset each control
Each control in the Effects popout (Blur, Deterioration, Overprint, Brightness, Contrast, Saturation, Tint, Noise, Dither, Pixel size, Ink starve, Softness, Roller, Roller angle, Blob size, Spray, Nicks and Seed) SHALL have its own **Reset**, which SHALL return only that control to its neutral value as one undo step named after the control.

The neutral values SHALL be:
- 0 for Blur, Deterioration, Brightness, Contrast, Saturation, Noise and Ink starve;
- 67 for Overprint;
- 0% Strength with Invert off for Tint;
- off with Remove white off for Dither;
- 2 for Pixel size;
- for the other Ink starve controls, their defaults: Softness 13, Roller 55, Roller angle 14°, Blob size 12, Spray 22, Nicks 25 and Seed 1.

A control's Reset SHALL be disabled while the control is at its neutral value (for Tint, Strength 0% with Invert off; for Dither, Dither off with Remove white off). A Reset SHALL also be disabled in these cases:
- Pixel size's, while Dither is off;
- Overprint's, while Deterioration is 0;
- the Resets of Softness, Roller, Roller angle, Blob size, Spray, Nicks and Seed, while Ink starve is 0.

Resetting SHALL keep related settings as follows:
- Resetting Tint SHALL turn Invert off within the same one "Tint" step and SHALL keep the chosen tint colour.
- Resetting Dither SHALL turn Remove white off within the same one "Dither" step and SHALL keep the chosen Pixel size.
- Resetting Pixel size SHALL leave Remove white as it is.
- Resetting Deterioration SHALL keep the chosen Overprint.
- Resetting Ink starve SHALL keep the other Ink starve controls as they are.

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

#### Scenario: Reset Ink starve keeps its settings
- **WHEN** a text box has Ink starve 40, Roller 80 and Seed 9, and the person clicks Ink starve's Reset
- **THEN** the text renders plain, the other Ink starve controls and their Resets are disabled, and raising Ink starve again uses Roller 80 and Seed 9

#### Scenario: Reset an Ink starve control
- **WHEN** an image has Ink starve 40 and Spray 70, and the person clicks Spray's Reset
- **THEN** Spray is 22 and its Reset is disabled, Ink starve is still 40, and the Edit menu offers "Undo Spray"

### Requirement: Effects grouped into sections
The Effects popout SHALL group its controls into sections, each framed by a hairline border with square corners.

For an image the sections SHALL be, in this order:
1. **Blur**
2. **Brightness**, **Contrast** and **Saturation**
3. **Tint**: Strength, colour and Invert
4. **Noise**
5. **Dither**: the Dither switch, Pixel size and Remove white
6. **Ink starve**: Ink starve, Softness, Roller, Roller angle, Blob size, Spray, Nicks and Seed

For a shape or a drawing the sections SHALL be the first five of these, in the same order, without Ink starve.

For a text layer the popout SHALL show only these sections, in this order:
1. **Blur**
2. **Overprint**: Deterioration and Overprint
3. **Ink starve**: the same controls as for an image

Each control's Reset SHALL stay with its control, inside its section. The note that some effects aren't supported in this browser SHALL still appear when it applies. The border colour SHALL come from the theme, so the sections read in both light and dark mode.

#### Scenario: Five sections for an image
- **WHEN** a rectangle is selected and the person opens Effects
- **THEN** the popout shows five framed sections, in order: Blur; Brightness, Contrast and Saturation; Tint with its colour and Invert; Noise; Dither with Pixel size and Remove white

#### Scenario: One section for text
- **WHEN** a text box is selected and the person opens Effects
- **THEN** the popout shows three framed sections, in order: Blur; Overprint with Deterioration and Overprint; Ink starve with its eight controls

#### Scenario: Both colour modes
- **WHEN** the colour mode is switched between Light and Dark with the Effects popout open
- **THEN** the section borders stay visible in both

#### Scenario: Six sections for an image
- **WHEN** an image is selected and the person opens Effects
- **THEN** the popout shows six framed sections, in order: Blur; Brightness, Contrast and Saturation; Tint with its colour and Invert; Noise; Dither with Pixel size and Remove white; Ink starve with its eight controls
