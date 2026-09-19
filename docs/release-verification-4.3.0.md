# NET 4.3.0 release verification

4.3.0 is suitable for opt-in use. The corrected simulator and JavaScript agree on 137 controlled-draw cases. This establishes the tested progression rules; it does not promise identical random sequences or universal improvement for every league.

| Check | Evidence |
|---|---|
| Full browser-script tests | 148 tests; both complete scripts, pinned BBGM helpers, eligibility and history guards. |
| Simulator parity | 137 identical fixtures replayed through production C++ headers; integer attributes and OVR match exactly. |
| Input precision | Real C++ loader preserves the 20-attempt threshold, fractional base ratings and exact 64-bit seed strings. |
| Real BBGM lifecycle | BBGM v2026.09.16.0733, new disposable league, WorkerConsole before a real 2019→2020 preseason transition, then NET. |
| History and persistence | Two expected players changed; 748 other records remained identical. Reload and full UI export matched stored results. |
| Supplemental guards | A valid free agent progressed; a watched retired player with two ratings rows retained its history. |

Live checks used a lexical controlled random draw to make the expected output inspectable while retaining the real game’s helpers, development, storage and value updates. Normal runs continue to use `Math.random()`. The final source differs from the exercised source only in its release header; byte comparison after restoring those comments verifies identical executable code.

An intentionally malformed player with an empty ratings array caused BBGM’s own global value recalculation to fail. That invalid-league experiment is retained in the evidence; it is not counted as successful acceptance. The valid one-row history guard passed. Use a valid league export and keep a backup before applying progression.

WorkerConsole’s age-25-before-preseason policy normally selects entering-age-26 players. Directly watching an entering-age-25 player is a separate supported choice. Negative-PER players contribute to pool statistics but retain BBGM progression. Candidate uses the last regular-season stint; Published 3.2 averages nonzero stints.

Progbox’s Published comparison pointer stays on `v3.2.1`. This release does not migrate an existing league, update Dexter’s old prog-range display, or publish an npm package. Distribution is the standalone scripts in this repository and the GitHub release.

The full review, corrected multi-seed comparisons, export hashes and reproducible evidence accompany the release. Earlier 359-player scorecards predate the fixes and are historical evidence only.
