## [4.3.0] - unpublished candidate

> **Not published.** Live leagues stay on **3.2.x** ↔ progbox **`v3.2.1`**. This entry documents the progbox **`v4.3`** port under review; do not cut a release tag from it yet.

### What changed (candidate)

- Production drivers are BPM + PER (70/30), not PER alone
- Age curve uses knees at 28 / 32 and a per-attribute shape (athleticism falls faster; touch holds)
- Soft ceiling replaces the hard OVR 80 cap
- Defenders get credit via STL% / BLK% / DBPM into dIQ, strength, and jump
- Noise scales with minutes; pool z-scores use age-25+ players with PER ≠ 0 (C++ `load_players` parity), not only watched players
- Under-25 watched players keep BBGM progs (ratings row is not wiped before the age gate)
- News Feed shows per-attribute Δ instead of a prog-range pair

### Breaking (if/when published)

- Old prog-range tables and `tiers.md` band equations no longer apply
- Dexter `/p` prog-range display is stale until Dexter is updated
- Re-running NET on the same league can differ — RNG is `Math.random()` with no seed

### How to run

Unchanged: Worker Console → BBGM progs → NET in Preseason.

## [3.2.0] - 2024-05-13 (published / live ↔ progbox v3.2.1)

### Added

- News Feed notifications for prog info and god-prog count

### Fixed

- Flag players via the `watch` property (not the old flag path)

### Changed

- Biome for linting and formatting
- File-tree / NET structure cleanup

## [3.1.1] - 2023-04-18

### Fixed

- Set flag operations to be performed via `watch` prop

### Changed

- Readme legibility

## [3.0.2] - 2023-06-06

### Fixed

- Set age of prog script takes affect to 25
- Fix for `ageRange` to be accessed by the notification system

## [3.0.1] - 2023-06-03

### Changed

- Players with 20 or less PER will use the equation of `per / 5 - 6, per / 4 - 1`
	- This equates to more fair progressions for average players
	- Additionally, players who are above a League avg of PER are still rewarded with a lower chance of going down, while not diminishing the prog ranges for players who are top-tier, 20+ PER

## [3.0.0] - 2023-06-02

### Added

- Set an OVR limit of 80 to the Prog Script. This is in an effort to incur balanced progressions
	- Players that occasionally get calculated to prog over the OVR Limit will have their prog reduced to place them exactly at the limit
	- `getAgeRange` function to assist `runProgs`

### Changed

- Age affected by the Prog Script to 25 and up; Meaning players who are 24 before progs will now be affected, as they turn 25 when progs occur (preseason phase, new season)
- Adjusted the equations for every age groups `Prog Range`. There is now a lower `high` for the Prog Range of every group
	- Additionally, made aging more realistic and hardcoded more restrictions for balance
		- Players 25-30 have a max prog of `4`, regardless of their PER
		- Players 31 - 34 have a max prog of `2`, regardless of their PER
		- Players 35+ have a max prog of `0`, regardless of their PER
		- Players that are already above 80+ OVR will not progress at all
- Refactored the `runProgs` function for readability and future maintenance
- Refactored `God Progs` for balance
	- Set a max OVR of 60
	- Set max chance of God Prog to 9%
	- Placed a scaling linear function. The worse the player, the higher the chance to God Prog

### Fixed

- God Progs min and max restrictions working as intended; Currently, God Progs will be random between 7 and 12
- God Prog notification to include prior OVR as other prog notifications do

## [2.0.0] - 2023-03-20

### Added

- Create chance for `God Progs`
- Create notification for count of god progs
- All players will have a 70% chance of a skill that is going up 5+ to change (between 1-5); Decreases with age

### Changed

- Re-designed notification system with bolding data keys and line seperation for readability
- +5 Prog Hardcoded Limit on each skill / prog for every player
- Adjusted the original penalty/limit of 26-29 being blocked from everything except 'endurance' and 'oldAgeKeys';
- Players aged 35+now have a random, 1-5% chance to prog a physical skill trait [speed, strength, jump etc]
- Collecting current season from within BBGM now, no manual edits required

### Removed

- Restriction/limit of 30+ y/o players from progression a physical skill trait

## [1.1.0]

### Added

- Notifications for the BBGM News Feed
	- Provides data for users and debugging on the prog range and PER collected for the player
- Wrapped script into a function

### Fixed

- Rookie players are no longer affected
