# Regression fixture provenance

`net_parity_cases.json` is byte-identical to progbox's
`api/vendor/progbox_cpp/tests/net_parity_cases.json` (SHA-256
`27420ff2a5882239e6a7db6a9933d486740834536001825ca8413b14bf42e318`).
Its references pin both NET source hashes and the BBGM revision. Regenerate
intentional changes with progbox's `tests/generate-net-parity.cjs`, passing the
Candidate script, pinned Published script, and this repository's
`tests/helpers/run-script.cjs`. Copy the resulting JSON to both repositories
and run both suites. Do not casually update golden expected values.

`published-972f9d3.js` is the complete unchanged
[Published source](https://github.com/fearandesire/noeyetest/blob/972f9d3c08476bd91276ea7327b0972dfba3a382/src/NoEyeTest.js).
The parity test verifies its hash before executing it. The main source remains
`src/NoEyeTest.js`; the Published fixture is only a test reference.

`bbgm/` contains exact upstream helper sources and their license. The source
manifest records commit-specific URLs and hashes. The harness verifies every
file, removes TypeScript annotations from limitRating/OVR, and extracts the
unchanged uniformSeed/randInt functions with only annotations/export keywords
removed. The fixtures do not implement a playable BBGM distribution.

Every parity case runs the complete NET script, awaits storage operations and
checks final attributes, OVR, god status, draw count, prior ratings and untouched
pool players. Normalized per-game fixture stats are converted back to raw BBGM
totals for this run. The Candidate pool contains the target exactly once when
eligible; all other pool players are unwatched. Separate behavioral tests assert
pool IDs and weighted moments, stale/traded/playoff selection, invalid inputs,
complete history preservation and WorkerConsole's before/after-season age gate.

The local adapter mocks storage, ratings-row copying, develop(0) and value
updates. It is not proof that the same script works in a deployed BBGM build;
disposable-league acceptance must record that build and before/after exports.
