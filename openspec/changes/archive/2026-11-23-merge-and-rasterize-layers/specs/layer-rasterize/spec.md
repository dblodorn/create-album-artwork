# Spec Delta

## Purpose

Lets someone turn layers into pixels: rasterize a single text, shape or drawing layer into an image, or merge several selected layers into one image, with everything that affects their look baked in.

## ADDED Requirements

### Requirement: Rasterize a layer
For a selected layer that isn't an image (text, a shape or a drawing), the editor SHALL offer **Rasterize**. Rasterize SHALL replace the layer with one image layer that:
- looks the same as the layer did, with its effects, shadow, opacity and blend mode included in the pixels;
- covers the layer's visible extent, including any blur or shadow that spreads past its edges;
- keeps the layer's position on the artboard and its place in the stacking order;
- starts with every effect at its neutral value, normal blend mode and full opacity, since the old ones are now part of the image.

The new image SHALL be selected afterwards. Rasterizing SHALL be one undo step named "Rasterize", and undoing it SHALL bring back the original layer as it was: editable, with its effects, in its place. Image layers SHALL NOT offer Rasterize.

#### Scenario: Rasterize text
- **WHEN** a text box reading "SIDE A" is selected and the person clicks Rasterize
- **THEN** the text box is replaced by an image of "SIDE A" in the same place and stack position, the image is selected, its row is labelled as an image, and the Edit menu offers "Undo Rasterize"

#### Scenario: Effects are baked in
- **WHEN** a shape with Blur 8 and Dither on is rasterized
- **THEN** the image looks the same as the shape did, including the blur's spread, and its effects all read as neutral

#### Scenario: Undo restores editable text
- **WHEN** the person rasterizes a text box and then undoes
- **THEN** the original text box is back, editable, with its font, effects and position, and the image is gone

#### Scenario: Images don't offer it
- **WHEN** an image layer is selected
- **THEN** no Rasterize action is offered

### Requirement: Merge layers
When two or more layers are selected, the editor SHALL offer **Merge**. Merge SHALL replace the selected layers with one image layer that:
- looks the same as they did together, with each layer's effects, shadow, opacity and blend mode included in the pixels, and their stacking order kept within the image;
- covers the combined visible extent of the selected layers;
- takes the stacking position of the topmost selected layer. Layers that weren't selected keep their order relative to each other; any that were between selected layers end up below the merged image;
- starts with neutral effects, normal blend mode and full opacity.

The merged image SHALL be selected afterwards. Merging SHALL be one undo step named "Merge", and undoing it SHALL bring back every original layer as it was, in its original stacking position. Merge SHALL work on any mix of images, text, shapes and drawings.

Where a blend mode needs layers below it to look right, the merged image SHALL include only the selected layers, so unselected layers below show through as they would without the merge.

#### Scenario: Merge three layers
- **WHEN** an image, a text box and a drawing are selected and the person clicks Merge
- **THEN** the three are replaced by one image covering all three, which is selected, the Layers panel shows one row for it, and the Edit menu offers "Undo Merge"

#### Scenario: Stacking position
- **WHEN** the stack from front to back is A, B, C, D and the person selects A and C and merges them
- **THEN** the stack is the merged image, then B, then D

#### Scenario: Undo restores the layers
- **WHEN** the person merges a text box with Tint 50% and an image, and then undoes
- **THEN** the text box and the image are back, each in its original stacking position, and the text box is editable with Tint 50%

### Requirement: Rasterized images keep their quality and persist
An image made by Rasterize or Merge SHALL be at 2 pixels per artboard unit, reduced as needed so its longer side is at most 2048 pixels, and SHALL be stored in the scene as an embedded image, with no reference to an outside URL. It SHALL survive a page reload, Save JSON followed by Load JSON, copy and paste, and the PNG export, like any other image. Rasterize and Merge SHALL work in every supported browser; in a browser without canvas-filter support the result SHALL look as the layers looked on screen there.

#### Scenario: Reload keeps the result
- **WHEN** the person merges two layers and reloads the page
- **THEN** the merged image is still there, in the same place, and the original layers are not

#### Scenario: Large merge
- **WHEN** layers covering the whole 1000-unit artboard are merged
- **THEN** the merged image is 2000 pixels on each side and fills the artboard

#### Scenario: Pasted copy
- **WHEN** a rasterized image is copied and pasted
- **THEN** the copy is an independent image that looks the same
