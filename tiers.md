# How the 4.3.0 candidate progresses players

**4.3.0 is an unpublished candidate.** Published/live NET remains **3.2.x** ↔ progbox **`v3.2.1`**. The candidate ports progbox **`v4.3`**.

The candidate drops the old age-band prog-range tables. Dexter `/p` still shows a "prog range" from the 3.x formulas — that display is stale until Dexter is updated. Trust the News Feed Δ line after you run the candidate.

## What drives a prog

1. **Production** — composite of BPM (70%) and PER (30%), measured as a reliability-weighted z-score against the age-25+ / PER≠0 league pool (active/free-agent players with valid birth data and ratings, using the last prior-season regular-season stint; not only watched players). Young high-production players develop faster; low-production players stagnate. Older high-production players resist decline better.
2. **Age** — youth improvement below 28, decline above 32, plus a per-attribute age shape (speed/jump fall faster; shooting touch and pass hold longer). IQ ratings ignore the global age term and only take their local nudge.
3. **Defense** — steal%, block%, and DBPM feed dIQ, strength, and jump. Lockdown defenders progress even when PER looks ordinary.
4. **Noise** — small per-attribute jitter plus one common shock for the whole player. Low-minute guys get noisier swings.

## Soft ceiling

Positive gains taper between OVR ~78 and ~82. There is no hard "stop at 80" clamp. Attributes still move independently near the top so one capped skill doesn't flatten the rest.

## God progs

Age under 30, OVR-scaled chance (max 9%), flat +7 to +13 inclusive on every rating except height. Bypasses the normal formula for that player that season. Published 3.2 uses +7 to +12; its upper endpoint is exclusive.

## Who is touched

Worker Console flags age 25+ before preseason, normally entering NET at 26+ after the season increment. NET can also progress a manually watched entering-age-25 player. It does not silently reassign watch flags.

Preparation requires active/free-agent status, integer team ID and positive integer birth year, nonempty ratings, entering age 25+, and finite nonzero PER from the last prior-season regular row. Progression additionally requires `watch === 1`, positive PER, not drafted in the prior season, and at least two ratings rows. Negative PER affects pool moments but never triggers progression. All skip guards run before removing a ratings row.

NET restores the prior ratings base after BBGM adds the preseason row. Attributes clamp to 0–100 and floor before the pinned BBGM OVR calculation. Stale-only and playoff-only histories are excluded. Candidate uses the last regular-season trade stint; Published averages nonzero prior-season regular PER rows. See the README for source pins and the distinction between local tests and live acceptance.
