# PAON Visual Wardrobe Studio — Precision Product Visualization & Fabric Fidelity Authority

**Status:** Prime product specification / implementation authority  
**Audience:** Claude Code, Codex/OpenAI, PAON engineering agents, future engineering team  
**Scope:** Retailer-neutral MTM menswear visual selling, wardrobe visualization, product configuration, fabric/material fidelity, garment-option fidelity, and generation verification  
**Intent:** Turn PAON's existing Virtual Wardrobe Studio into a production-grade visual selling engine that can be used by any MTM / premium menswear retailer, independent of Atelier Munro or any specific supplier.

---

# 0. Executive Product Contract

PAON Visual Wardrobe Studio is not a generic AI image generator and not a conventional factory configurator.

It is a **strict visual selling system** that converts authoritative customer, garment, fabric, style, fit, and retailer data into highly faithful visual representations that a retailer can use during selling, wardrobe planning, remote consultation, merchandising, and aftercare.

The core promise is:

> Given a known customer, a known garment configuration, a known fabric or material, and a known visual context, PAON must generate a visual that preserves the specified product characteristics with controlled, auditable fidelity rather than allowing the image model to invent or reinterpret them.

This system must support retailers that do not possess supplier-provided campaign photography, fully dressed mannequins, 3D configurators, or photorealistic product renders.

The system therefore becomes a **retailer-neutral visual product engine**.

It must let a retailer:

- upload or import products;
- upload fabric swatches;
- define exact physical swatch dimensions;
- define fabric repeat dimensions where applicable;
- define garment construction options;
- define buttons, linings, trims, collars, lapels, pockets, vents, cuffs and other visual design variables;
- define product fit and silhouette;
- map customer fit/style preferences;
- combine catalogue products and owned wardrobe items;
- place garments on a customer, mannequin or generated model;
- change scene/background while preserving the garment;
- generate complete looks;
- generate single-garment views;
- generate alternative design configurations;
- compare options;
- regenerate without losing locked attributes;
- verify generated output against the requested configuration;
- reject or quarantine an image that cannot be proven sufficiently faithful.

The system must be useful for:

- MTM suit retailers;
- shirt specialists;
- premium menswear retailers;
- wedding/formalwear retailers;
- made-to-order brands;
- multi-brand boutiques;
- uniform/corporate tailoring;
- supplier/showroom businesses;
- any retailer that needs customer-specific product visualization without possessing perfect source photography.

---

# 1. Non-Negotiable Product Principles

## 1.1 Structured truth before image generation

The image model is never the source of truth.

Truth comes from structured PAON records:

- customer identity;
- customer measurements;
- fit profile;
- garment type;
- garment configuration;
- fabric identity;
- fabric physical dimensions;
- fabric pattern repeat;
- color;
- material characteristics;
- buttons;
- lining;
- trims;
- product metadata;
- retailer configuration;
- supplier constraints;
- approved visual references.

The image model receives a compiled visual specification derived from these facts.

## 1.2 AI must not invent locked details

Any attribute marked `locked` must be preserved.

Examples:

- lapel type;
- lapel width;
- button count;
- button color;
- pocket configuration;
- vent configuration;
- trouser pleats;
- side adjusters;
- cuffs;
- shirt collar;
- shirt cuff;
- fabric pattern;
- fabric scale;
- fabric orientation;
- fabric color;
- lining;
- fit archetype;
- garment length;
- shoulder expression;
- trouser rise;
- trouser width.

If the pipeline cannot preserve a locked attribute with acceptable confidence, it must fail closed.

## 1.3 Fabric scale is a first-class physical property

Fabric is not merely a bitmap.

A swatch represents a real physical area.

PAON must know:

- the physical width represented by the swatch image;
- the physical height represented by the swatch image;
- pixel dimensions;
- image orientation;
- weave/pattern direction;
- pattern repeat width and height when applicable;
- whether the swatch is a representative crop or a full repeat;
- whether the image contains perspective distortion;
- whether color calibration is available.

The system must preserve physical pattern scale when applying the fabric to a garment.

A 10 mm pinstripe must not become a 25 mm stripe.

A 40 mm windowpane must not become a 90 mm windowpane.

A herringbone must not change apparent repeat size because an image model decided it “looked better.”

This is a hard product invariant.

## 1.4 Visual selling truth is distinct from manufacturing truth

PAON Visual Wardrobe Studio represents:

> customer-facing visual truth.

A factory configurator represents:

> manufacturing truth.

The Visual Wardrobe Studio may integrate with manufacturing systems, but it must not claim that an image is a production instruction.

The canonical chain is:

```text
Customer / Wardrobe / Fit
        ↓
Product & Garment Configuration
        ↓
Visual Specification
        ↓
Visual Wardrobe Studio
        ↓
Customer-facing visualization
```

Manufacturing may separately consume:

```text
Order Configuration
        ↓
Supplier / Factory Adapter
        ↓
Manufacturing specification
```

The two may share structured configuration, but they are separate authorities.

---

# 2. Product Boundaries

## 2.1 In scope

- photorealistic visualization;
- customer-specific visualization;
- mannequin visualization;
- generated model visualization;
- garment-only visualization;
- outfit visualization;
- background replacement;
- scene generation;
- fabric replacement;
- fabric scale enforcement;
- option replacement;
- locked attribute preservation;
- customer fit approximation;
- garment silhouette approximation;
- style preference use;
- wardrobe-awareness;
- supplier-neutral catalogue ingestion;
- retailer-specific configuration;
- visual comparison;
- visual history;
- save/share/proposal workflows;
- AI cost allocation;
- retailer-paid generation usage;
- visual QA;
- manual approval;
- regeneration;
- visual provenance;
- traceability.

## 2.2 Explicitly not manufacturing authority

The visual system must not independently determine:

- factory pattern pieces;
- seam allowances;
- grading;
- production tolerances;
- cutting instructions;
- BOM;
- machine operations;
- production feasibility not represented by structured supplier rules;
- factory pricing;
- supplier production capacity.

These belong to production systems unless explicitly added later.

---

# 3. Prime User Journeys

## 3.1 Advisor-led visualization

```text
Open customer
→ choose garment / fabric / style
→ review existing customer fit/style profile
→ configure options
→ generate visual
→ inspect fidelity
→ compare alternatives
→ save approved look
→ attach to proposal/order/appointment
```

## 3.2 Customer-led wardrobe studio

```text
Open wardrobe
→ choose owned garment or catalogue item
→ choose complementary items
→ choose design/fabric options where allowed
→ generate
→ save / reject / regenerate
→ feed preference evidence back into PAON
```

## 3.3 Fabric-first selling

```text
Upload/select fabric
→ inspect physical scale and characteristics
→ choose garment type
→ choose construction/design
→ select customer/model
→ render fabric at correct physical scale
→ compare against other fabrics
```

## 3.4 Product-image replacement

For a retailer with poor or inconsistent product photography:

```text
Retailer imports product
→ defines product configuration
→ attaches source photos/swatches
→ selects house scene/model template
→ generates normalized product imagery
→ validates product fidelity
→ publishes approved visuals
```

## 3.5 Background-only transformation

```text
Approved product visual
→ lock garment + customer
→ select new scene
→ regenerate only environment
→ compare preservation
→ accept only when garment-lock verification passes
```

---

# 4. Canonical Domain Model

The implementation should use PAON's existing domain architecture and naming conventions. Exact table names may be adapted to existing schema, but the conceptual boundaries below are binding.

## 4.1 VisualGarmentConfiguration

```ts
interface VisualGarmentConfiguration {
  id: VisualGarmentConfigurationId;
  retailerId: RetailerId;

  garmentType: GarmentType;
  sourceProductId?: ProductId;
  sourceWardrobeItemId?: WardrobeItemId;

  fabricAssignment: FabricAssignment;

  silhouette: GarmentSilhouette;
  construction: GarmentConstruction;
  designOptions: GarmentDesignOptions;

  lockedAttributes: readonly VisualAttributeKey[];

  customerFitProfileId?: CustomerFitProfileId;
  visualFitOverrides?: VisualFitOverrides;

  createdByStaffId?: StaffId;
  createdByCustomerId?: CustomerId;

  version: number;
  createdAt: string;
  updatedAt: string;
}
```

## 4.2 FabricMaterial

```ts
interface FabricMaterial {
  id: FabricMaterialId;
  retailerId: RetailerId;
  supplierId?: SupplierId;

  supplierCode?: string;
  collectionCode?: string;
  bunchCode?: string;
  displayName: string;

  fiberComposition?: readonly FiberComponent[];
  nominalWeightGsm?: number;
  weightClass?: "ultralight" | "light" | "medium" | "heavy" | "coating";
  weave?: FabricWeave;
  finish?: FabricFinish;
  stretch?: FabricStretchProfile;

  baseColor?: ColorReference;
  secondaryColors?: readonly ColorReference[];

  pattern: FabricPatternDefinition;

  swatches: readonly FabricSwatchAsset[];

  drapeProfile?: DrapeProfile;
  surfaceProfile?: SurfaceProfile;

  visualStatus: "unverified" | "calibrated" | "approved" | "rejected";
}
```

## 4.3 FabricSwatchAsset

This is critical.

```ts
interface FabricSwatchAsset {
  id: FabricSwatchAssetId;

  storageBucket: string;
  storagePath: string;

  pixelWidth: number;
  pixelHeight: number;

  physicalWidthMm: number;
  physicalHeightMm: number;

  dpiEquivalent?: number;

  captureType:
    | "flatbed_scan"
    | "calibrated_camera"
    | "supplier_digital"
    | "uncalibrated_photo";

  perspectiveRectified: boolean;

  orientation: {
    warpAxisDegrees: number;
    weftAxisDegrees: number;
    topMeansGarmentUp: boolean;
  };

  calibration?: SwatchCalibration;

  crop?: {
    sourceImageId?: string;
    x: number;
    y: number;
    width: number;
    height: number;
  };

  approvedForGeneration: boolean;
}
```

## 4.4 SwatchCalibration

```ts
interface SwatchCalibration {
  method:
    | "known_physical_dimensions"
    | "fiducial_marker"
    | "calibration_card"
    | "supplier_metadata"
    | "manual";

  physicalWidthMm: number;
  physicalHeightMm: number;

  pixelsPerMmX: number;
  pixelsPerMmY: number;

  perspectiveHomography?: readonly number[];

  colorProfile?: {
    sourceProfile?: string;
    targetProfile: "sRGB";
    deltaE?: number;
  };

  calibratedAt: string;
  calibratedByStaffId?: StaffId;
}
```

## 4.5 FabricPatternDefinition

```ts
interface FabricPatternDefinition {
  kind:
    | "solid"
    | "microtexture"
    | "stripe"
    | "pinstripe"
    | "chalkstripe"
    | "check"
    | "windowpane"
    | "glen_check"
    | "houndstooth"
    | "herringbone"
    | "birdseye"
    | "donegal"
    | "jacquard"
    | "other";

  repeatWidthMm?: number;
  repeatHeightMm?: number;

  dominantStripeSpacingMm?: number;
  secondaryStripeSpacingMm?: number;

  rotationDegrees: number;

  symmetry?: "none" | "horizontal" | "vertical" | "both";

  repeatConfidence:
    "supplier_verified" | "machine_measured" | "staff_verified" | "estimated";
}
```

---

# 5. Physical Fabric Scale — Hard Requirement

This is a prime differentiator.

## 5.1 Problem

Image models frequently treat fabric swatches as style references instead of physical materials.

Given a 250 mm × 200 mm swatch image, the model may:

- enlarge a pattern;
- shrink a pattern;
- reinterpret stripe spacing;
- distort checks over sleeves;
- change pattern scale between jacket panels;
- change scale between front and back;
- change scale between jacket and trousers;
- rotate weave direction;
- hallucinate a different repeat.

PAON must prevent this.

## 5.2 Required invariant

For every approved generated garment:

```text
apparent pattern scale on garment
≈ physical pattern scale of source fabric
within defined tolerance
```

Target tolerances:

- geometric checks / stripes: ±3% ideal, ±5% maximum;
- larger irregular repeats: ±5%;
- microtextures: perceptual consistency rather than exact repeat;
- solids: color/surface fidelity rules instead.

Any result outside the allowed tolerance must fail visual QA.

---

# 6. Fabric Scale Calibration Pipeline

## 6.1 Preferred capture workflow

Retailer receives a physical swatch.

Recommended capture:

1. Place swatch flat.
2. Include a known physical calibration target in the same plane.
3. Photograph perpendicular to the surface or scan.
4. Store exact swatch dimensions.
5. Rectify perspective.
6. Crop fabric region.
7. normalize orientation.
8. measure pattern repeat.
9. store calibrated pixels-per-mm.
10. produce canonical texture assets.

The best practical field workflow should support a printed PAON calibration card containing:

- 100 mm × 100 mm reference square;
- high-contrast fiducial markers;
- orientation arrow;
- neutral gray patches;
- optional color reference patches.

The calibration card lets PAON derive physical scale from the image rather than trusting camera distance.

## 6.2 Perspective rectification

For camera captures, the system must estimate a planar homography.

Given four known calibration corners:

```text
source image plane
→ homography
→ rectified physical plane
```

The output texture becomes orthographic.

A swatch photographed at an angle must never be mapped directly.

## 6.3 Canonical texel density

All calibrated swatches should be normalized to a canonical internal density.

Example:

```text
10 pixels per mm
= 100 pixels per cm
= 1000 pixels per 10 cm
```

The exact internal density may be tuned, but must be consistent.

Do not derive garment pattern scale from arbitrary uploaded image resolution.

Derive it from:

```text
physicalWidthMm
physicalHeightMm
pixelWidth
pixelHeight
```

## 6.4 Repeat detection

For patterned fabrics, PAON should compute candidate repeat dimensions using:

- 2D autocorrelation;
- Fourier-domain periodicity;
- normalized cross-correlation;
- edge/line spacing;
- user-assisted correction.

Machine measurement produces a candidate.

Staff may confirm or override.

Supplier-provided repeat metadata outranks inference when trustworthy.

## 6.5 Manual verification UI

The calibration UI must show:

- swatch;
- ruler overlay in mm/cm;
- detected repeat rectangle;
- detected warp/weft orientation;
- pattern spacing;
- physical dimensions;
- zoomed repeat;
- simulated 10 cm × 10 cm preview.

Staff must be able to correct:

- scale;
- repeat width;
- repeat height;
- rotation;
- crop;
- physical dimensions.

The system must store who approved the calibration.

---

# 7. Fabric Texture Asset Pipeline

From a calibrated swatch, generate canonical derivative assets.

## 7.1 Base color texture

Perspective-corrected, physically scaled diffuse/albedo image.

## 7.2 Seamless tile

When appropriate, create a seamless tile using:

- repeat-aware cropping;
- phase-aligned boundaries;
- edge blending;
- minimal content alteration.

For checks/stripes, prefer exact geometric repeat boundaries over generative texture synthesis.

## 7.3 PBR derivative maps

Where 3D rendering is used, derive or author:

- base color;
- normal;
- roughness;
- specular;
- optional displacement;
- optional sheen;
- optional anisotropy.

AI-estimated maps may be used only as visual approximations and must never alter pattern geometry.

## 7.4 Fabric physical metadata

Drape behavior should consider:

- GSM;
- fiber;
- weave;
- finish;
- stiffness;
- thickness;
- stretch;
- surface roughness.

The visual system should not render a 350 gsm flannel with the same fall as an 180 gsm tropical wool.

This can initially use rule-based classes:

```text
ultralight
light
medium
heavy
coating
```

with retailer/supplier overrides.

---

# 8. Two Rendering Modes

PAON should support two complementary fidelity paths.

# 8A. Geometry-Controlled 3D Path

Use this when exact scale and construction fidelity are paramount.

Pipeline:

```text
garment geometry
→ UV coordinates with known physical correspondence
→ calibrated texture
→ material properties
→ customer/body/mannequin
→ renderer
→ optional AI enhancement
```

## 8A.1 Physical UV invariant

Every garment mesh must define a physical UV scale.

Example:

If a jacket chest panel covers 420 mm of physical garment width, the texture coordinates applied to it must map exactly the corresponding physical millimeters from the fabric texture.

Never arbitrarily “fit texture to UV.”

The engine must use a physical mapping function:

```text
garment surface millimeters
↔ fabric texture millimeters
```

## 8A.2 Pattern alignment

Support garment-specific alignment rules:

- vertical stripes remain vertical;
- checks align across center fronts where tailoring convention requires;
- sleeve orientation follows grainline;
- pocket pattern alignment may be controlled;
- lapel orientation derives from pattern construction;
- trouser stripe direction follows trouser grainline.

This is far more reliable than asking an image model to infer tailoring pattern alignment.

## 8A.3 AI enhancement boundary

AI may improve:

- realism;
- lighting;
- skin;
- scene;
- small fabric surface appearance.

AI must not alter:

- garment geometry;
- locked design options;
- pattern scale;
- pattern orientation;
- color beyond tolerance.

Use masks / structural conditioning where supported.

---

# 8B. Controlled 2D Generative Path

Use when 3D geometry is unavailable or speed is prioritized.

The 2D path must still enforce physical scale.

## 8B.1 Garment physical reference

The system needs an estimate of visible garment dimensions.

Sources may include:

1. known 3D body measurements;
2. customer measurement profile;
3. calibrated mannequin/model dimensions;
4. detected body landmarks with known/estimated anthropometric dimensions;
5. source garment metadata.

## 8B.2 Scale anchor

Before generation, compute how many pixels in the target image correspond to a known physical garment distance.

Example:

```text
visible jacket chest width ≈ 520 mm
target chest span ≈ 1040 px

=> 2 px/mm
```

A 40 mm check repeat therefore must appear approximately every:

```text
40 mm × 2 px/mm = 80 px
```

in that local plane before perspective effects.

## 8B.3 Perspective-aware pattern projection

Do not simply tile the swatch over a 2D silhouette.

Approximate the garment surface using:

- body segmentation;
- garment segmentation;
- pose landmarks;
- depth estimation;
- surface-normal estimation;
- coarse garment UV proxy;
- piecewise homographies or mesh warping.

Then project the calibrated texture with perspective.

The image model may use this projected image as a high-strength visual condition.

## 8B.4 Locked texture reference

For patterned fabrics, the generated input should contain a pre-projected texture map at correct scale.

The generative model is asked to preserve it, not recreate the pattern from the raw swatch.

This is critical.

The input hierarchy should be:

```text
STRUCTURE CONTROL
+
PRE-PROJECTED PHYSICAL TEXTURE
+
DESIGN MASKS
+
CUSTOMER IDENTITY
+
SCENE
+
TEXT PROMPT
```

not:

```text
raw fabric swatch
+
"please put this on a jacket"
```

---

# 9. Scale Verification After Generation

Generation alone is insufficient.

The system must verify the result.

## 9.1 Geometric pattern verification

For stripes/checks:

1. segment garment;
2. estimate local perspective;
3. detect pattern lines/repeats;
4. estimate repeat spacing;
5. normalize for perspective;
6. compare to requested physical repeat;
7. calculate error.

Example:

```ts
interface PatternScaleVerification {
  expectedRepeatWidthMm: number;
  expectedRepeatHeightMm?: number;

  observedRepeatWidthMm: number;
  observedRepeatHeightMm?: number;

  widthErrorPercent: number;
  heightErrorPercent?: number;

  orientationErrorDegrees: number;

  status: "pass" | "warn" | "fail";
}
```

## 9.2 Cross-panel consistency

Check that pattern scale is consistent across:

- body;
- sleeves;
- lapels;
- trousers;
- waistcoat;
- visible rear panels.

Perspective can change apparent size, but recovered physical scale should remain consistent.

## 9.3 Color verification

Compare representative garment regions against calibrated fabric color.

Use perceptual color distance where possible.

Do not demand identical RGB values because lighting affects rendered appearance.

Instead separate:

- material identity;
- lighting;
- perceptual color drift.

Store a confidence score.

## 9.4 Attribute verification

Use deterministic or multimodal inspection to verify:

- lapel type;
- lapel width class;
- button count;
- button color;
- pocket type;
- vents;
- cuff;
- pleats;
- waistband;
- side adjusters;
- collar;
- lining when visible;
- trouser break;
- jacket length class;
- silhouette.

## 9.5 Fail-closed thresholds

A visual must have status:

```text
generated
→ verifying
→ approved_auto
OR
→ needs_review
OR
→ rejected
```

Customer-facing publication should require:

```text
approved_auto
or
approved_manual
```

for strict-selling contexts.

---

# 10. Visual Fidelity Score

Each result should receive a structured score.

```ts
interface VisualFidelityScore {
  overall: number; // 0..1

  identity?: number;
  garmentGeometry: number;
  fabricScale: number;
  fabricPattern: number;
  fabricColor: number;
  lockedAttributes: number;
  fitSilhouette: number;
  scenePreservation?: number;

  blockingFailures: readonly VisualFidelityFailure[];
}
```

Recommended hard blockers:

- wrong garment type;
- wrong lapel;
- wrong button count;
- wrong pocket type;
- wrong fabric identity;
- pattern scale outside maximum tolerance;
- major color mismatch;
- missing garment piece;
- hallucinated design detail;
- identity mismatch beyond allowed threshold;
- prohibited/unsupported option combination.

Overall score must not override a hard blocker.

---

# 11. Garment Configuration Schema

The configuration system must be extensible and retailer-neutral.

## 11.1 Jacket options

At minimum:

- jacket type;
- single/double breasted;
- button count;
- button stance;
- lapel type;
- lapel width;
- lapel belly;
- gorge height;
- notch/peak shape;
- breast pocket;
- hip pocket type;
- hip pocket angle;
- ticket pocket;
- vents;
- jacket length;
- shoulder expression;
- shoulder padding;
- sleeve head;
- sleeve button count;
- functional/non-functional sleeve buttons;
- stitching/pick stitching;
- lining type;
- lining material;
- lining color/pattern;
- button material;
- button color;
- boutonniere;
- internal personalization where visually relevant.

## 11.2 Trouser options

- rise;
- waistband style;
- belt loops;
- side adjusters;
- extended waistband;
- pleat count;
- pleat direction;
- front pocket style;
- rear pocket style;
- trouser width;
- taper;
- hem;
- cuff/turn-up;
- cuff depth;
- break;
- side-seam details.

## 11.3 Waistcoat

- single/double breasted;
- number of buttons;
- lapel/no lapel;
- neckline;
- pocket type;
- back fabric;
- back adjuster.

## 11.4 Shirt

- collar family;
- collar point length;
- spread;
- collar height;
- button-down;
- placket;
- front;
- cuff type;
- cuff length;
- cuff shape;
- pocket;
- back pleats;
- darts;
- hem;
- monogram;
- buttons;
- contrast fabric where allowed.

## 11.5 Outerwear

Provide extensible configuration for:

- overcoats;
- raincoats;
- field jackets;
- safari jackets;
- overshirts;
- bombers;
- leather;
- knitwear.

Do not encode every option as a global enum.

Use garment-template capability definitions.

---

# 12. Garment Template Capability Model

Each retailer/supplier garment template defines allowed options.

```ts
interface GarmentTemplate {
  id: GarmentTemplateId;
  retailerId: RetailerId;

  garmentType: GarmentType;
  displayName: string;

  capabilities: readonly GarmentOptionCapability[];

  visualReferences: readonly VisualReference[];

  defaultConfiguration: GarmentDesignOptions;

  constraintSetId: GarmentConstraintSetId;
}
```

Example capability:

```ts
interface GarmentOptionCapability {
  key: VisualAttributeKey;
  allowedValues: readonly string[];
  defaultValue: string;
  visualizable: boolean;
  productionSupported?: boolean;
  requires?: readonly ConstraintExpression[];
  excludes?: readonly ConstraintExpression[];
}
```

---

# 13. Constraint Engine

The engine must reject impossible or retailer-disallowed configurations before generation.

Examples:

```text
double_breasted
requires lapel ∈ {peak, shawl}

shirt_button_down
may exclude certain formal collar structures

side_adjusters
may exclude belt_loops for a given house rule

unlined_jacket
may exclude certain internal-lining visual selections
```

Rules may come from:

- canonical menswear knowledge;
- retailer house rules;
- supplier rules;
- garment-template rules.

Precedence:

```text
supplier hard constraint
> retailer hard constraint
> garment-template hard constraint
> canonical compatibility rule
> recommendation
```

Hard constraints block.

Recommendations warn.

Never convert style preference into production impossibility.

---

# 14. Customer Fit & Body Model

The visual system should consume the existing PAON fit profile rather than inventing a second customer-sizing system.

Inputs may include:

- height;
- weight;
- body measurements;
- posture;
- shoulder slope;
- shoulder asymmetry;
- chest;
- waist;
- hip;
- seat;
- arm length;
- leg length;
- stance;
- fit preference;
- historical alteration evidence;
- approved fit profile;
- customer perception evidence.

The visual model is not a measurement engine unless explicitly validated for that use.

The output should express:

- slimmer/roomier silhouette;
- jacket length;
- trouser width;
- rise;
- break;
- shoulder expression;
- drape.

It must never claim millimeter-perfect fit prediction unless the underlying model supports it.

---

# 15. Fabric Drape & Weight Rules

Fabric weight and structure affect visualization.

A rules layer should map:

```text
fabric properties
+
garment construction
+
fit
→ visual drape profile
```

Example classes:

### Ultralight

- softer folds;
- greater movement;
- potentially more transparency;
- less sculpted structure.

### Light

- fluid;
- fine folds;
- less body.

### Medium

- balanced structure/drape.

### Heavy

- larger folds;
- more body;
- stronger silhouette;
- less flutter.

### Coating

- thick edge appearance;
- strong structure;
- larger bend radius.

Additional modifiers:

- linen wrinkling;
- flannel nap;
- velvet sheen;
- mohair crispness;
- cashmere softness;
- seersucker surface;
- high-twist wool dryness;
- stretch fabric tension.

These are visual rules and should be configurable.

---

# 16. Retailer-Neutral Catalogue Model

PAON must not require Munro-specific assets.

Each retailer may provide:

- product image;
- flat lay;
- mannequin image;
- model image;
- technical sketch;
- swatch;
- supplier SKU;
- garment template;
- design option metadata;
- fabric metadata.

The system should normalize heterogeneous inputs into PAON's canonical visual representation.

Retailers with excellent supplier assets benefit from them.

Retailers with poor assets can still generate high-quality visual selling imagery.

This is a core commercial differentiator.

---

# 17. Source Asset Quality Levels

Classify every source asset:

```text
A — calibrated / supplier-authoritative
B — high-quality retailer source
C — usable but uncalibrated
D — low-quality reference
```

Generation strictness should depend on source quality.

Do not claim perfect fidelity from a low-quality swatch.

The UI must communicate confidence honestly.

---

# 18. Generation Specification Compiler

Do not hand-author giant prompts in Server Actions.

Create a deterministic compiler:

```ts
compileVisualGenerationSpecification(input)
  → VisualGenerationSpecification
```

Example:

```ts
interface VisualGenerationSpecification {
  version: string;

  subject: VisualSubjectSpecification;
  garments: readonly VisualGarmentSpecification[];
  customer?: VisualCustomerSpecification;
  scene: VisualSceneSpecification;

  locks: readonly VisualLock[];
  constraints: readonly VisualConstraint[];

  referenceAssets: readonly VisualReferenceAsset[];

  verificationPlan: VisualVerificationPlan;
}
```

The provider adapter then translates this provider-neutral specification into:

- text prompt;
- masks;
- reference images;
- control images;
- seed/config;
- model parameters.

PAON domain truth must never depend on one image provider's API.

---

# 19. Prompt Structure

The prompt should have deterministic sections:

```text
ROLE
SUBJECT
GARMENT STRUCTURE
FABRIC / MATERIAL
PHYSICAL SCALE
FIT / SILHOUETTE
LOCKED ATTRIBUTES
SCENE
NEGATIVE CONSTRAINTS
OUTPUT REQUIREMENTS
```

Example principle:

```text
The fabric reference is not a stylistic suggestion.
It represents a real material with a repeat of 40 mm × 40 mm.
Preserve this physical repeat scale across all visible garment panels.
Do not enlarge, shrink, reinterpret, simplify or replace the pattern.
```

However, prompt text alone is insufficient.

Physical scale must be enforced through projected/reference assets and post-generation verification.

---

# 20. Multi-Pass Generation

For strict configurations, prefer staged generation.

## Pass 1 — Structure

Generate/establish:

- pose;
- customer;
- garment silhouette;
- construction;
- options;
- scene.

Use neutral material if necessary.

## Pass 2 — Material projection

Apply calibrated fabric to garment regions at correct physical scale.

## Pass 3 — Detail integration

Integrate:

- buttons;
- lining;
- stitching;
- small trims.

## Pass 4 — photoreal enhancement

Improve realism while locking structure/material.

## Pass 5 — verification

Run fidelity checks.

This is preferable to asking one generative call to solve every constraint simultaneously.

---

# 21. Editing Existing Visuals

Edits must use explicit lock semantics.

Example:

```text
Change:
- fabric only

Locked:
- customer identity
- pose
- jacket geometry
- lapel
- buttons
- pockets
- fit
- trousers
- shoes
- background
```

Each edit creates a child generation record referencing the prior approved image and exact delta.

---

# 22. Background / Scene Engine

Scenes are separate from product truth.

Support:

- studio;
- retail interior;
- office;
- wedding;
- evening;
- travel;
- business;
- outdoor;
- retailer-branded environment;
- custom uploaded scene.

A background change must not mutate the garment.

Verification should compare before/after garment regions.

---

# 23. Versioning & Provenance

Every generated image must be reconstructable conceptually.

Store:

- configuration version;
- fabric version;
- swatch asset;
- calibration version;
- garment template version;
- customer fit profile version;
- provider;
- provider model;
- generation parameters;
- prompt/specification hash;
- input asset hashes;
- output;
- verification results;
- approval state;
- cost;
- timestamps.

Never silently overwrite a prior visual configuration.

---

# 24. Cost & Retailer Billing

Generation cost should be attributable.

Store:

- provider;
- model;
- input cost;
- output cost;
- retries;
- verification cost;
- total generation cost;
- retailer;
- staff/customer;
- purpose;
- linked opportunity/order/proposal.

Support retailer policies:

```text
monthly included generations
per-generation pass-through
markup
hard limit
soft warning
manager approval threshold
premium model opt-in
```

Commercial terms remain configurable and founder-controlled.

The system should support treating AI generation as retailer sales-acquisition / conversion cost.

---

# 25. Permissions

At minimum:

Customer:

- generate where retailer permits;
- see own images;
- save/reject;
- cannot alter retailer-authoritative supplier rules.

Advisor:

- configure allowed visual options;
- generate for assigned/authorized customer;
- save to proposal/client context.

Manager:

- approve fabrics;
- approve calibration;
- configure templates;
- configure generation policy;
- inspect spend.

Retailer admin:

- manage suppliers;
- manage provider configuration;
- manage house visual rules.

Platform admin:

- operational diagnostics only according to PAON authorization policy.

All rows remain tenant-bound.

---

# 26. Moderation and Safety

Generation must respect platform policy and retailer boundaries.

Prevent:

- unauthorized identity use;
- customer images being used across tenants;
- unconsented style portrait use;
- storage leakage;
- cross-retailer fabric/catalogue leakage.

Customer imagery requires existing PAON consent controls.

---

# 27. Observability

Every stage emits structured telemetry:

```text
request_received
spec_compiled
assets_resolved
fabric_calibrated
generation_started
generation_finished
verification_started
verification_failed
manual_review_required
approved
rejected
published
```

Metrics:

- success rate;
- retry rate;
- fidelity-failure rate;
- scale-failure rate;
- average generation time;
- provider cost;
- cost per approved visual;
- acceptance rate;
- regeneration rate;
- retailer usage;
- conversion linkage.

---

# 28. Failure Modes

## 28.1 Fabric scale mismatch

Action:

```text
reject
→ record measured error
→ regenerate with stronger physical projection
→ manual review if repeat failure
```

## 28.2 Wrong garment option

Reject.

Never show as approved.

## 28.3 Provider cannot follow constraints

Fallback provider/model if policy permits.

Otherwise mark unsupported.

## 28.4 Poor swatch

Request calibration or improved source.

Do not fake certainty.

## 28.5 Customer identity drift

Reject according to identity-preservation threshold.

## 28.6 Unsupported combination

Block before generation.

---

# 29. Fabric Calibration UI — Required UX

The fabric setup experience should be one of the most polished parts of PAON.

Flow:

```text
Upload swatch
→ enter/confirm physical dimensions
→ automatic perspective correction
→ ruler overlay
→ automatic pattern repeat detection
→ confirm warp/weft orientation
→ preview 1:1 physical repeat
→ preview on standard jacket test model
→ approve
```

Display:

- supplier;
- bunch;
- article;
- composition;
- weight;
- pattern;
- repeat;
- confidence;
- scale status.

Include a visual 10 cm ruler over the swatch.

---

# 30. Visual Studio UI

The selling interface should feel materially better than a classic configurator.

Recommended composition:

### Left

Customer / model

### Center

Large visualization canvas

### Right

Contextual configuration panels

Sections:

- Look
- Garment
- Fabric
- Design
- Fit
- Details
- Scene

Do not expose every parameter simultaneously.

Progressive disclosure.

Configuration changes should show:

```text
Locked
Changed
Inherited
Recommended
Unavailable
```

---

# 31. Design Comparison

Support side-by-side:

```text
A / B
```

Examples:

- notch vs peak;
- navy vs charcoal;
- 9 cm vs 11 cm lapel;
- flannel vs high-twist;
- no pleat vs single pleat;
- office vs evening context.

Each comparison shares all locked variables except the explicit delta.

This gives the customer confidence that only the requested variable changed.

---

# 32. Customer Presets

Use existing PAON personalization.

Examples:

```text
prefers soft shoulder
prefers higher rise
prefers fuller trouser
avoids narrow lapels
prefers neutral palette
often business casual
travels frequently
runs warm
```

These may influence defaults and recommendations.

They must not silently override retailer/product constraints.

UI should distinguish:

```text
Your usual preference
House recommendation
Selected configuration
```

---

# 33. AI Recommendation Boundary

AI may recommend:

- fabrics;
- combinations;
- design options;
- scene;
- fit direction.

But the configuration engine validates the recommendation before it reaches generation.

```text
AI suggestion
→ constraint engine
→ accepted / corrected / rejected
```

Never allow an LLM to bypass deterministic constraints.

---

# 34. Supplier Integration

Supplier adapters may import:

- fabric metadata;
- collection;
- swatch images;
- stock;
- repeat dimensions;
- composition;
- weight;
- color;
- article codes;
- visual assets;
- garment templates.

PAON canonicalizes these.

Do not make the core system supplier-specific.

---

# 35. Retailer-Specific House Style

Retailers may define:

- default lapel widths;
- house silhouette;
- preferred trouser rise;
- house shoulder;
- default pocket style;
- photography style;
- background scenes;
- model profiles;
- visual tone.

These are configuration, not code forks.

---

# 36. Testing Strategy

## 36.1 Unit

Test:

- physical scale math;
- pixels/mm;
- repeat normalization;
- constraint engine;
- configuration inheritance;
- locked attributes;
- provider-spec compiler;
- fidelity thresholds.

## 36.2 Golden fabric tests

Create canonical swatches with known repeats:

```text
10 mm stripe
20 mm stripe
40 × 40 mm check
60 × 40 mm windowpane
known herringbone repeat
solid
microtexture
```

Every rendering pipeline must be tested against these.

## 36.3 Golden garment tests

Fixed garment/model configuration with known expected properties.

## 36.4 Metamorphic tests

Change one variable only.

Example:

```text
same everything
lapel notch → peak
```

Verify all unrelated attributes remain unchanged.

This is crucial for generative systems.

## 36.5 Cross-provider tests

Provider changes must satisfy the same specification.

Provider quality can differ.

Domain truth cannot.

## 36.6 Tenant isolation

Swatches, customer portraits, configuration, generated images and provider records must never cross retailers.

## 36.7 E2E

Browser proof:

```text
retailer imports/calibrates fabric
→ advisor selects customer
→ configures jacket
→ generates
→ image passes verification
→ saves look
→ customer sees approved result
```

---

# 37. Fabric Scale Acceptance Tests

A dedicated acceptance suite is mandatory.

## Test A — 20 mm stripe

Given:

```text
physical swatch width = 200 mm
10 stripes across width
```

Expected stripe pitch:

```text
20 mm
```

On rendered jacket, recovered local stripe pitch must remain within ±5%.

## Test B — 40 mm check

Check repeat remains 40 mm across:

- chest;
- sleeve;
- trouser.

After perspective correction.

## Test C — image resolution independence

Two source files:

```text
1000 px representing 200 mm
4000 px representing 200 mm
```

must produce the same physical garment pattern scale.

This test is non-negotiable.

## Test D — crop independence

Different crops of the same calibrated fabric must retain identical repeat scale.

## Test E — generation model independence

Provider/model change must not alter requested physical scale outside tolerance.

---

# 38. Database Requirements

Exact migration design should follow PAON conventions.

Likely entities:

```text
fabric_materials
fabric_swatch_assets
fabric_calibrations
fabric_pattern_definitions
garment_templates
garment_template_options
garment_constraint_sets
visual_garment_configurations
visual_generation_specs
visual_generation_assets
visual_fidelity_checks
visual_generation_attempts
visual_approvals
visual_provider_policies
```

Prefer extension of existing PAON entities when equivalent concepts already exist.

Before migrations:

> inspect current schema and reuse existing entities.

Do not duplicate wardrobe, product, fabric, visualization-job, provider or personalization concepts.

---

# 39. Migration Policy

New schema:

- forward-only migrations;
- tenant-owned rows carry `retailer_id`;
- RLS;
- same-tenant references;
- generated types;
- repository coverage;
- security tests;
- upgrade rehearsal where existing data changes.

No destructive rewriting of existing production-shaped data.

---

# 40. Repository Architecture

Follow existing PAON rules.

Conceptual placement:

```text
@paon/domain
  fabric physical model
  garment configuration
  constraints
  fidelity rules
  generation specification

@paon/database
  repositories
  persistence
  RPC interaction

@paon/ai
  provider-neutral generation runner
  provider adapters
  verification adapters

apps/retailer
  fabric calibration
  catalogue setup
  advisor studio
  policy/admin

apps/customer
  wardrobe studio
  saved looks
  customer generation
```

No provider-specific logic in domain.

No Supabase calls directly from UI.

---

# 41. Rollout Phases

## Phase VWS-P1 — Canonical configuration

Build:

- garment configuration schema;
- garment template capabilities;
- deterministic constraints;
- lock semantics.

Acceptance:

A jacket/shirt/trouser configuration can be represented completely without generation.

## Phase VWS-P2 — Fabric physical calibration

Build:

- physical dimensions;
- pixels/mm;
- perspective correction metadata;
- repeat detection;
- calibration UI;
- golden fabric tests.

Acceptance:

The same fabric at different image resolutions yields identical physical texture scale.

## Phase VWS-P3 — Strict generation specification

Build provider-neutral specification compiler.

Acceptance:

All generation inputs are traceable and deterministic.

## Phase VWS-P4 — Physical material projection

Implement:

- 3D physical UV path where available;
- 2D calibrated projection path otherwise.

Acceptance:

Golden scale tests pass.

## Phase VWS-P5 — Fidelity verifier

Implement:

- pattern-scale verification;
- option verification;
- color verification;
- hard blockers;
- manual review.

Acceptance:

Known wrong-scale outputs fail automatically.

## Phase VWS-P6 — Retailer-neutral Visual Studio

Build polished advisor UI.

Acceptance:

A retailer with only a product record + calibrated swatch can create a controlled sales visual without supplier campaign imagery.

## Phase VWS-P7 — Customer integration

Connect:

- wardrobe;
- style profile;
- fit;
- personalization;
- complete-the-look;
- saved looks;
- feedback.

## Phase VWS-P8 — Commercial controls

Build:

- retailer policies;
- AI spend;
- usage controls;
- provider activation;
- observability.

---

# 42. Definition of Product Completion

This prime feature is not complete until a retailer can:

1. create/import a garment template;
2. upload a physical fabric swatch;
3. specify or calibrate its real dimensions;
4. verify fabric repeat;
5. assign the fabric to the garment;
6. choose design options;
7. choose a customer/model;
8. generate a visual;
9. receive the fabric at correct physical scale;
10. verify locked garment details;
11. compare alternatives;
12. save an approved result;
13. use it in a customer-facing selling workflow;
14. understand when fidelity is insufficient;
15. regenerate/review;
16. see generation cost;
17. operate without developer/database intervention.

---

# 43. Definition of "Fabric Scale Nailed"

The following must all be true:

- image resolution does not affect physical pattern scale;
- swatch crop does not affect physical scale;
- camera perspective is corrected before texture use;
- repeat dimensions are known or explicitly marked unknown;
- pattern orientation is known;
- garment projection uses physical dimensions;
- scale is not entrusted solely to prompt language;
- output scale is measured after generation;
- incorrect scale is rejected;
- same fabric renders consistently across garments;
- same fabric renders consistently across providers within tolerance;
- visual comparison preserves scale;
- staff can inspect calibration;
- every approved image traces to a specific calibrated swatch version.

If any of these are missing, PAON cannot claim strict fabric-scale fidelity.

---

# 44. Prime Commercial Positioning

Do not sell this as:

> AI fashion image generation.

Do not primarily sell this as:

> an MTM configurator.

Sell it as:

> **PAON Visual Wardrobe Studio — a customer-specific visual selling engine for premium menswear.**

Core commercial claim:

> Turn your real fabrics, products, garment options, customer fit and wardrobe context into controlled, retailer-specific selling visuals — even when your suppliers provide no usable campaign photography or configurator assets.

The system should work for:

```text
supplier-rich retailer
+
supplier-poor retailer
+
single-brand MTM
+
multi-brand MTM
+
independent tailor
+
premium ready-to-wear retailer
```

This independence is a strategic requirement.

---

# 45. Critical Anti-Shortcut Rules

Claude/Codex must NOT:

- implement fabric mapping by prompt wording alone;
- assume pixel dimensions imply physical dimensions;
- resize patterns aesthetically;
- generate an uncalibrated swatch and call it precise;
- make Munro-specific assumptions core architecture;
- treat visual similarity as physical scale correctness;
- mix production truth and visual truth;
- duplicate PAON's existing wardrobe/product/fabric entities without inspection;
- build another unrelated configurator;
- skip post-generation verification;
- mark the feature complete from a single impressive demo image.

---

# 46. Agent Execution Instruction

When this specification becomes an active PAON build item:

1. Read current `AGENTS.md`.
2. Inspect existing Virtual Wardrobe Studio, garment, product, fabric, style portrait, metadata, fit, visualization job, provider and evidence architecture.
3. Use Haiku/explorer workers to map what already exists.
4. Produce a gap map against this specification.
5. Do not rebuild capabilities that already exist.
6. Resolve architecture on the frontier.
7. Implement vertically in the rollout phases above.
8. Delegate settled implementation.
9. Independently verify worker output.
10. Preserve existing customer/advisor Virtual Wardrobe flows.
11. Prioritize fabric calibration and physical scale infrastructure before cosmetic UI expansion.
12. Add deterministic tests before claiming precision.
13. Do not stop after scaffolding.
14. Continue until each active phase has authoritative persistence, UI, verification and evidence.
15. Record genuine blockers but route around them according to `AGENTS.md`.

---

# 47. Strategic Importance

Treat this as a **prime PAON capability**, not an optional image-generation experiment.

It creates a commercially important bridge between:

```text
customer intelligence
+
wardrobe
+
fit
+
retailer catalogue
+
supplier fabric
+
garment design
+
visual selling
```

and allows PAON to deliver sophisticated visual merchandising even to retailers that lack:

- supplier campaign photography;
- dressed mannequins;
- 3D product assets;
- proprietary configurators;
- expensive visualization infrastructure.

The strategic objective is not to replace every manufacturing configurator.

It is to make PAON the **best visual selling layer sitting above any retailer's existing product and production ecosystem**.

---

# 48. Final Binding Principle

The differentiator is not that PAON can generate a beautiful jacket.

The differentiator is:

> **PAON knows exactly whose jacket it is, what garment it is, which fabric it uses, how large that fabric pattern is in the physical world, which design options are selected, how the customer prefers it to fit, which details are locked, what the retailer permits, what the generated image actually preserved, and whether the image is trustworthy enough to sell from.**

That is the product.
