# Overview of NoEyeTest

**NoEyeTest** (NET) is a Browser Basketball GM progression script.

**4.3.0** is an opt-in release of the progbox **`v4.3`** model. League owners choose when to adopt it.

Progbox keeps **NET 3.2 / `v3.2.1`** as its Published comparison baseline; **`v4.3`** remains the Candidate catalog entry. Releasing NET does not change that comparison pointer.

## Preliminary Information

[**NoEyeTest**](src/NoEyeTest.js) finds players to re-prog by the `watch` flag (the red bar-chart icon in BBGM).

For a visual, here's an example of a player who is flagged

![A player who's bar chart icon are colored red](https://i.imgur.com/m77zErh.png)

And a player who isn't

![A player who is not flagged](https://i.imgur.com/7CvLHUp.png)

- [**Worker Console**](src/WorkerConsole.js) runs **before** progs each season.
- Worker Console flags players aged **25+ before preseason**. After BBGM increments the season, these normally enter NET at **26+**. NET itself accepts manually watched entering-age-25 players; it does not change the Worker Console roster.

## Instructions

1. Before progs, run [**Worker Console**](src/WorkerConsole.js) in the _Danger Zone_
2. After progs (aka, in the `Preseason` phase), run [**NET**](src/NoEyeTest.js) in the _Danger Zone_
3. Check the *News Feed* for Δ / PER / age / OVR lines on watched players

**_News Feed Post-NET:_**
![Prog Range Information](https://i.imgur.com/TCjuz3E.png)

### How 4.3.0 decides progs

See [tiers.md](tiers.md) for the short story: production drivers, age curve, soft ceiling, god progs. There is no fixed `[min, max]` prog-range table in 4.3.

## Additional Information (4.3.0)

- Under 30: rare god prog (OVR-scaled, max ~9%, flat +7 to +13 on every rating except height)
- Soft ceiling: positive gains taper from OVR ~78 toward ~82; negative movement is not tapered the same way
- Pool preparation uses active/free-agent players (`tid >= -1`) with integer team and birth-year values, a positive birth year, nonempty ratings, entering age 25+, and finite nonzero PER from the last prior-season regular-season row. Negative PER contributes to this pool; watch status does not restrict it.
- Progression additionally requires `watch === 1`, not drafted in the prior season, positive PER, and at least two ratings rows. Every skip happens before ratings removal, preserving the complete BBGM history.
- RNG is `Math.random()` — BBGM has no seed, so re-runs differ
- News Feed reports progressed players and eligible watched players skipped for missing/nonpositive PER.

## Runtime contract and tests

Run once in preseason after BBGM progression: if the entering season is `S`, NET reads stats from `S-1`, computes age as `S - born.year`, removes the just-added BBGM ratings row only for eligible players, and rebuilds from the previous row. It selects the **last regular-season stint** for `S-1`; playoffs, stale seasons and a zero-PER last stint cannot supply a replacement. Published NET 3.2 at commit `972f9d3c08476bd91276ea7327b0972dfba3a382` instead averages all nonzero regular-season PER rows for `S-1`.

BBGM clamps attributes to 0–100 and **floors** fractional ratings before deriving OVR. The simulator must follow that integer contract; older fractional C++ outputs are historical research results, not proof of JS runtime parity. Candidate god bonuses are inclusive **7–13**; the pinned Published script uses **7–12**.

```sh
pnpm install --frozen-lockfile
pnpm test
pnpm exec biome check .
```

Tests execute the complete browser script in an async Node VM with controlled randomness and player storage. They verify pool membership/moments, stats selection, unchanged skipped histories, the preseason age boundary, and integer ratings/OVR. The same 137 controlled-draw cases in [the shared fixture](tests/fixtures/net_parity_cases.json) also run against the real C++ progression headers in progbox; they cover normal/god branches, bonus endpoints, soft ceilings, clamps, fractional ratings, weighted pools and attempt thresholds for both Candidate and pinned Published scripts. Exact BBGM rating and integer-random helpers are pinned to revision `0ae7a104d541ad0a4806de083819b19735cbf301`; [the source manifest](tests/fixtures/bbgm/sources.json) records URLs and hashes. Vendored helpers retain their [upstream license](tests/fixtures/bbgm/LICENSE.md) and are used only by tests. Storage, `addRatingsRow`, `develop(0)` and values updates are test doubles: these checks do not establish a deployed BBGM revision or live lifecycle acceptance. A separate disposable-league check passed on BBGM **v2026.09.16.0733**, including a real preseason transition, skipped histories, persistence after reload, and full before/after exports. See [release verification](docs/release-verification-4.3.0.md) for scope and limitations.

## Why this exists

Default BBGM from ~26 onward leans hard into random regression. One off-season can kneecap an all-star or stall someone who should be peaking. NET is for multiplayer leagues (and anyone who wants performance-linked progs): good seasons move the needle, lockdown defenders aren't buried by low PER, and aging follows a curve instead of a single harsh dice roll.

#### Credits

The idea and certain elements derive from TheProgMaestro. NET 3.2.x tracks progbox **`v3.2.1`**. The 4.3.0 release ports progbox **`v4.3`** (@akshayexists upstream).
