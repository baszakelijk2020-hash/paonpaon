# PAON Workforce Mission Control

**Status:** target product and technical design.

## Product position

PAON should become the operating layer between retail leadership, managers and
employees. It should not initially become a multi-country payroll/tax engine.

In 2026 the normal modern pattern is:

- management publishes schedules;
- employees clock in/out and record breaks;
- the system flags attendance, overtime and missing-punch exceptions;
- managers approve corrected timesheets;
- an immutable pay-period package syncs or exports to payroll/accounting;
- ADP, Gusto, Paycor, an accountant or another provider performs salary
  calculation, statutory deductions, filing and payout.

Retail workforce platforms combine scheduling, attendance, shift swaps,
availability, labor forecasting and payroll integration. Sources:
[ADP time and attendance](https://www.adp.com/what-we-offer/time-and-attendance.aspx),
[Deputy retail workforce management](https://www.deputy.com/industry/retail),
and [Homebase retail](https://www.joinhomebase.com/retail).

PAON should own the work context those generic systems lack: appointments,
client promises, clienteling missions, selling ceremony, knowledge, service
handoffs, data quality and visible extra-mile recognition.

## Roles

- **Owner/leadership:** labor-to-sales view, branch coverage, risk, culture and
  unresolved exceptions.
- **Manager:** roster, approvals, coverage, assignments, briefings, coaching,
  recognition and payroll package sign-off.
- **Advisor/employee:** shifts, clock, Today missions, customer work, tasks,
  learning, daily closeout and I AM profile.
- **Accountant/payroll operator:** approved pay-period export and correction
  packages, never customer details.
- **PAON Admin:** connector/processing health only.

## One employee home

The Mission Control home is arranged by urgency:

1. clock status and current branch;
2. customers/appointments requiring preparation;
3. promises and tasks due today;
4. sparse clienteling opportunities;
5. store missions and operational checks;
6. learning/coaching prompt;
7. team information;
8. end-of-shift closeout.

It is not eight different dashboards. Managers gain control layers on the same
objects.

## Scheduling and time

Core entities:

- employment profile and branch eligibility;
- contract/availability constraints;
- shift template and published shift;
- shift offer/swap/coverage request;
- time entry with clock-in/out, breaks and source;
- exception and correction request;
- approval;
- pay period and immutable export version;
- external payroll mapping.

Capture methods:

- shared branch kiosk with PIN or secure sign-in;
- employee mobile/web at assigned branch;
- POS/partner event import;
- manager correction with reason and audit.

Optional geofence/photo/device evidence is adapter capability, not a mandatory
culture. PAON records the evidence source and never calls an unverified punch
"fraud".

Rules are versioned by retailer/jurisdiction/contract and evaluated into
reviewable warnings: missed break, early/late, overtime, overlapping shifts,
unapproved work and insufficient rest. Rules do not silently rewrite worked
time.

## Labor optimization

Forecast demand from:

- historical hourly sales and appointments;
- live/predicted customer presence;
- deliveries, fittings and service pickups;
- campaigns/events;
- branch seasonality and opening hours;
- staff skills and customer ownership.

The output is an explainable recommendation:

> Saturday 13:00–16:00 is forecast 1.4 advisors short: five appointments, a
> campaign event and the branch's 12-week walk-in pattern.

Managers approve changes. The optimizer preserves required skills and existing
commitments before cost.

## Tasks and promises

Every task has owner, branch/customer/order/garment context, due/expiry,
priority, evidence, completion proof appropriate to the work and an exception
reason. It can originate from:

- manager;
- appointment closeout;
- customer promise;
- clienteling projector;
- stock/service exception;
- campaign playbook;
- training/ceremony;
- external connector.

Completion should be five seconds when possible. A high-value promise may
require an outcome; wiping a surface does not require an essay.

## Daily briefing and closeout

### Opening

- store target and focus;
- arrivals and unavailable products;
- appointments with preparation;
- client moments;
- campaign/service missions;
- one relevant knowledge card;
- explicit ownership.

### Ten-minute closeout

Use short rectangles and only expand when necessary:

- promises made and their due dates;
- customer facts learned with provenance;
- opportunities created;
- problems requiring management;
- stock/service anomalies;
- one thing that worked;
- one "extra mile" act;
- help or coaching requested.

Closeout facts enter the same reviewable Self-Portrait and task architecture,
not a diary nobody uses.

## I AM and extra-mile recognition

Employees need evidence that invisible work is seen. The I AM profile contains:

- role and certified capabilities;
- client/service/production strengths;
- completed learning and manager observations;
- customer outcomes and kept promises;
- peer/manager/customer acknowledgements;
- employee-authored extra-mile entries;
- contribution timeline and growth goals.

An extra-mile entry is a claim, not an automatically scored truth. It can link
to a customer, task, appointment or outcome, with private-manager visibility
where appropriate. Managers acknowledge, comment or nominate it for a
recognition moment.

Avoid a raw leaderboard that rewards volume. Recognize distinct behaviors:
client rescue, collaboration, craftsmanship, knowledge sharing, operational
reliability and commercial initiative. Normalize for hours/role/opportunity
and show qualitative evidence.

## Coaching and selling ceremony

Mission Control delivers contextual prompts:

- before appointment: discovery questions and wardrobe gap;
- during closeout: required facts and promises;
- after missed outcome: objection reflection;
- weekly: roleplay/rubric or manager observation;
- monthly: behavior-to-outcome review.

Completion quality cannot be gamed by empty checkboxes. The system measures
customer response, appointment conversion, kept promises, data correction,
service outcomes and learning improvement.

## Payroll boundary

PAON produces an approved package containing:

- employee external payroll ID;
- regular/overtime/leave hours by earning code;
- approved allowances/commissions only when their calculation contract exists;
- exceptions and correction version;
- manager approval;
- checksum, exported time and provider acknowledgement.

It excludes customer details. A corrected closed period produces a new
adjustment version; it does not mutate the exported package.

## Required views

- employee Today and I AM;
- team roster, attendance and coverage;
- timesheet exception inbox;
- manager approval and pay-period export;
- leadership labor/demand/culture dashboard;
- store briefing and closeout;
- tasks/promises and recognition feed;
- payroll connector health.

## Delivery slices

1. Existing roster/time entries → approval and exception lifecycle.
2. Pay-period package + generic payroll/accountant export.
3. Unified Today tasks/promises and briefing.
4. Closeout + extra-mile recognition and I AM.
5. availability/swaps/coverage and manager publication.
6. explainable demand/coverage recommendation.
7. payroll provider adapters based on customer demand.

The platform should help managers produce accurate payroll input and better
work. It should not claim to replace regulated payroll merely because it can
sum hours.
