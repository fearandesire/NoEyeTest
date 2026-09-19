# Overview of NoEyeTest

**NoEyeTest** (NET) is a Browser Basketball GM progression script.

**Published / live:** **3.2.x** (aligned with progbox **`v321`**). That is what leagues should run today.

**4.3.0** on this branch is an **unpublished candidate** — a port of progbox `v43` for review. Do not treat it as released.

## Preliminary Information

[**NoEyeTest**](src/NoEyeTest.js) finds players to re-prog by the `watch` flag (the red bar-chart icon in BBGM).

For a visual, here's an example of a player who is flagged

![A player who's bar chart icon are colored red](https://i.imgur.com/m77zErh.png)

And a player who isn't

![A player who is not flagged](https://i.imgur.com/7CvLHUp.png)

- [**Worker Console**](src/WorkerConsole.js) runs **before** progs each season.
- NET targets age **25+**. Worker Console flags 25+ by default because NET runs **after** normal BBGM progs and rebuilds that ratings row.

## Instructions

1. Before progs, run [**Worker Console**](src/WorkerConsole.js) in the _Danger Zone_
2. After progs (aka, in the `Preseason` phase), run [**NET**](src/NoEyeTest.js) in the _Danger Zone_
3. Check the *News Feed* for Δ / PER / age / OVR lines on watched players

**_News Feed Post-NET:_**
![Prog Range Information](https://i.imgur.com/TCjuz3E.png)

### How the 4.3.0 candidate decides progs

See [tiers.md](tiers.md) for the short story: production drivers, age curve, soft ceiling, god progs. There is no fixed `[min, max]` prog-range table in 4.3.

## Additional Information (4.3.0 candidate)

- Under 30: rare god prog (OVR-scaled, max ~9%, flat +7 to +13 on every rating except height)
- Soft ceiling: positive gains taper from OVR ~78 toward ~82; negative movement is not tapered the same way
- Pool pass uses every age-25+ player with a real season row (PER ≠ 0) so z-scores match C++ `load_players`, not just your flagged roster
- Under-25 watched players are left alone — BBGM's own progs stand
- RNG is `Math.random()` — BBGM has no seed, so re-runs differ
- News Feed still logs each watched player after NET runs

## Why this exists

Default BBGM from ~26 onward leans hard into random regression. One off-season can kneecap an all-star or stall someone who should be peaking. NET is for multiplayer leagues (and anyone who wants performance-linked progs): good seasons move the needle, lockdown defenders aren't buried by low PER, and aging follows a curve instead of a single harsh dice roll.

#### Credits

The idea and certain elements derive from TheProgMaestro. Live 3.2.x tracks progbox `v321`. The 4.3.0 candidate ports progbox `v43` (@akshayexists upstream).
