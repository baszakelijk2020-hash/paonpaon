# Reference capability matrix

Research date: 2026-08-14. This is a capability observation, not a design source.

| Capability                      | Suitsupply public configurator                                                                        | Armani MTM URL                                | PAON interpretation                                                  |
| ------------------------------- | ----------------------------------------------------------------------------------------------------- | --------------------------------------------- | -------------------------------------------------------------------- |
| Entry and product scope         | Direct public entry; Fabric, Jacket, Trousers, Waistcoat tabs                                         | No interactive DOM exposed in browser session | Lab starts with one jacket only                                      |
| Fabric discovery                | Search control and a large visible fabric list; cards show colour, composition/name and price         | Inaccessible                                  | Small explained cloth-character set, not catalogue browsing          |
| Price and delivery              | Total price and `2-3 weeks delivery` visibly update in shell                                          | Inaccessible                                  | Explicitly absent: no price or lead-time claim                       |
| Construction                    | Jacket tab is exposed after fabric selection                                                          | Inferred; not observed                        | Original option taxonomy and compatibility contract                  |
| Camera/zoom/mobile              | A layered visual control is exposed; exact camera/gesture behaviour not concluded                     | Inaccessible                                  | Fixed comparison camera; optional orbit only after performance proof |
| Fit, size, cart, share, advisor | Not fully exercised in this pass; do not infer                                                        | Inaccessible                                  | Out of scope for the lab                                             |
| Accessibility/fallback          | Interactive elements include buttons/tabindex in snapshot; full keyboard/fallback audit not performed | Inaccessible                                  | Keyboard radios, semantic headings, no-WebGL poster required         |

## Observation protocol and limitations

Directly observed through a public browser session: Suitsupply's custom-made configurator exposes a `Start designing` action, product tabs, fabric search, many clickable fabric cards and visible total/delivery messaging. Example visible labels included wool flannel, cotton corduroy, wool/cashmere and linen blends. This confirms capability breadth only.

`https://mtmconfigurator.armani.com` loaded with no interactive elements in this environment. It is recorded as inaccessible/possibly geo-, script- or session-gated; no behaviour is attributed to it. Login, cart, prohibited combinations, mobile interaction, save/share, advisor continuation, sizing, lining, buttons, vents and personalization were not fully verified and remain unobserved.

## Sources

| Source                   | Organization | Date accessed | URL                                            | Relevance / limitation                                       |
| ------------------------ | ------------ | ------------: | ---------------------------------------------- | ------------------------------------------------------------ |
| Custom Made configurator | Suitsupply   |    2026-08-14 | https://custommade.suitsupply.com/configurator | Primary live observation; dynamic commercial UI, not copied. |
| Made-to-measure overview | Suitsupply   |    2026-08-14 | https://suitsupply.com/en-us/men/custom-made   | Primary public context; availability and claims can change.  |
| MTM configurator         | Armani       |    2026-08-14 | https://mtmconfigurator.armani.com             | Primary target but inaccessible in this pass; no inference.  |
