# How 4.3 progresses players

4.3 drops the old age-band prog-range tables. Dexter `/p` still shows a "prog range" from the 3.x formulas — that display is stale until Dexter is updated. Trust the News Feed Δ line after you run NET.

## What drives a prog

1. **Production** — composite of BPM (70%) and PER (30%), measured as a reliability-weighted z-score against the whole league pool (not only watched players). Young high-production players develop faster; low-production players stagnate. Older high-production players resist decline better.
2. **Age** — youth improvement below 28, decline above 32, plus a per-attribute age shape (speed/jump fall faster; shooting touch and pass hold longer). IQ ratings ignore the global age term and only take their local nudge.
3. **Defense** — steal%, block%, and DBPM feed dIQ, strength, and jump. Lockdown defenders progress even when PER looks ordinary.
4. **Noise** — small per-attribute jitter plus one common shock for the whole player. Low-minute guys get noisier swings.

## Soft ceiling

Positive gains taper between OVR ~78 and ~82. There is no hard "stop at 80" clamp. Attributes still move independently near the top so one capped skill doesn't flatten the rest.

## God progs

Same idea as 3.2: age under 30, OVR-scaled chance (max 9%), flat +7 to +13 on every rating except height. Bypasses the normal formula for that player that season.

## Who is touched

Worker Console flags age 25+. NET only rewrites ratings for `watch === 1` players who are 25+ with a real non-playoff PER that season. Younger players and zero-PER rows keep BBGM's own progs.
