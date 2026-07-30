# PAON Fit, MeasurementMonitor, and Service Network

**Status:** target product and technical design.

## The technically credible ceiling

PAON can use guided smartphone images to detect likely body/garment fit change,
estimate shape/measurement candidates and prioritize a review. It must not
silently replace approved tailoring measurements from one casual clothed
photograph.

Research supports smartphone measurement potential but also shows material
error from loose clothing, pose and landmark ambiguity. Even dedicated 3D
scanners vary by measurement and scan garment. Sources:
[smartphone body measurement study](https://www.mdpi.com/2079-9292/10/11/1338)
and [3D body scanning reliability](https://research.manchester.ac.uk/en/publications/3d-body-scanning-has-suitable-reliability-an-anthropometric-inves).

The revolutionary, feasible product is an always-available **fit drift
monitor**, not a magic tape measure.

## Measurement authority

Three layers never collapse:

1. **Approved measurement version:** recorded/approved by qualified staff and
   referenced by a garment order.
2. **Fitting observation:** garment-specific posture, ease and alteration
   evidence.
3. **Customer self-scan candidate:** image-derived or declared signal awaiting
   review.

A scan can raise a "confirm before cut" gate. Only an authorized review creates
a new approved measurement version.

## Guided capture

The customer receives an in-app sequence:

- select a known garment and identify when it fit well;
- capture front, side and optional rear under consistent distance/height;
- use pose silhouette and live guidance;
- record camera/device, known height and capture quality;
- ask current weight only if the customer elects to provide it;
- capture specific fit feedback: collar, shoulder, chest, waist, seat, thigh,
  sleeve and length;
- optionally compare a baseline photograph of the same garment.

Quality gates reject occlusion, wrong pose, excessive loose layers, poor light
or absent scale rather than producing false precision.

## MeasurementMonitor output

The output is a review object:

- overall drift score and capture quality;
- likely regions of change;
- silhouette/garment drape differences;
- candidate measurement ranges, never spurious decimals;
- model/version and confidence;
- baseline reference;
- customer fit statements;
- recommendation: no action, advisor review, guided re-scan, remote fit call or
  in-person measurement;
- expiry and evidence links.

Customer copy:

> Your jacket appears tighter through the waist than in the March baseline.
> This is a fit check, not a new measurement. Ask your advisor to review before
> the next reorder.

Advisor copy can show technical overlays and candidate deltas.

## Reorder decision gate

Before an online made-to-measure reorder:

1. retrieve the last approved measurement version and garment outcome;
2. evaluate elapsed time, customer-declared change, self-scan drift, previous
   alterations and high-risk garment type;
3. choose:
   - reuse approved version;
   - advisor async review;
   - remote fit appointment;
   - in-person remeasure;
4. record human decision and reason;
5. lock the selected approved version to the order.

The gate increases reorder confidence precisely because it can stop an unsafe
reorder.

## Fit learning

After delivery/fitting/alteration, collect structured outcomes:

- region and direction of issue;
- garment vs body-measurement vs make-up cause;
- alteration performed;
- amount and pattern/posture note;
- satisfaction after change;
- whether the approved measurement/template should change for future garments.

Project learning into a candidate delta. Do not mutate historical measurements
or apply one garment's styling ease as body truth.

## Service network

Fit intelligence connects to:

- retailer fitters;
- internal alteration workshop;
- approved third-party alterations;
- dry cleaning and garment care;
- pickup/delivery;
- specialist shoe/leather repair.

Work order contains only necessary customer contact/custody and garment data.
Partners do not receive lifestyle or browsing intelligence.

## Accounting layer

For each service:

- customer-facing quote/price;
- retailer-funded entitlement or customer payment;
- agreed partner cost;
- pickup/delivery cost;
- tax/accounting codes;
- partner invoice/reference;
- retailer margin/subsidy;
- refund/rework;
- reconciliation status.

Operational cost tracking can ship before money activation. Actual charging,
store credit and partner payout require the approved provider/accounting
contract.

## Technical components

- encrypted/private capture assets with expiring access;
- consent/purpose and retention;
- capture-quality model;
- body/garment landmark and segmentation pipeline;
- baseline alignment;
- versioned feature extraction and drift projector;
- review queue;
- fit decision gate;
- evaluation set with human tailor labels;
- false-positive/negative reporting by garment/body/capture condition;
- correction and deletion recomputation.

Do not train a model on retailer customer images without an explicit,
separately governed training basis.

## Evaluation

Measure:

- capture completion and reject rate;
- agreement with tailor review by region;
- absolute candidate measurement error where ground truth exists;
- unnecessary appointment vs prevented risky reorder;
- re-cut/alteration rate after gate decision;
- performance across body shapes, skin tones, devices, garments and mobility
  conditions;
- customer/advisor trust and correction.

## Delivery

1. structured self-scan + private evidence + advisor review.
2. baseline garment comparison and deterministic risk gate.
3. model-assisted capture quality and regional drift candidate.
4. controlled measurement-estimation pilot with ground truth.
5. reorder gate integration and outcome evaluation.
6. broader service-network dispatch/custody/accounting.

The Face ID analogy is useful for product aspiration—continuous adaptation—but
not a claim of equivalent sensing or accuracy.
