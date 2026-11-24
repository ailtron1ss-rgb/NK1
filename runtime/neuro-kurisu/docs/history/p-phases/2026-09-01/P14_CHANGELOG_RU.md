# P14 ChangeLog

## Added
- event-driven perception;
- sensor change detection;
- salience routing;
- external event ingress;
- camera bridge;
- perception status APIs;
- UI perception panel and camera control;
- P14 tests and research lab;
- schema migration `16 -> 17`.

## Changed
- application `6.0.0`;
- organism core `15.0.0-embodied-perception`;
- capability probing cached for 60 seconds;
- perception now participates in cognitive pressure and network signals.

## Fixed
- static sensor values no longer trigger the same perception event indefinitely;
- camera temp files are removed after successful hashing;
- old tests can call `OrganismCore.observe()` without a body;
- server event endpoint now supplies current body context.
