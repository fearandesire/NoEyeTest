/**
 * NoEyeTest: BBGM Prog Script
 * This script is used to calculate the 'Prog Range' (PR) for a player.
 * A prog range is how low, or high high a player can progress in the off-season.
 * The prog range is calculated by taking the player's PER from the previous season
 * Currently, this is designed for players 25+.
 *
 * Credits to TheProgMaestro for the original code this stemmed from, which I have now modified to create my own distirbution of it.
 */

// collect all players
const players = await bbgm.idb.cache.players.getAll();
const seasonYr = 2012; // MUST be changed before running progs to match the prior season year
// iterate through the players
for (const p of players) {
  const recentStats = p.statsTids;

  // Only control progs for players that do not have the 'classic' note on them
  if (p.note !== "classic") {
    const name = `${p.firstName} ${p.lastName}`;
    let per = 0;
    // Filter (into an array) the stats for the player that meet our criteria: Last season, non-playoffs, and there has to be a PER value (this is to avoid grabbing the most recent season's stats, which, at the time of progs, will be completely empty)
    const playerStats = p.stats.filter(
      (stat) => stat.season === seasonYr && stat.per !== 0 && !stat.playoffs
    );
    /**
     * Every season creates 1 object to collect stats in for the player.
     * If the player is traded mid-season, there will be duplicate object to collect stats for the player relating to the new team, but within the same season.
     * This originally created an issue with the script, as PER was being grabbed incorrectly, or even worse, resulting in a NaN or 0 value, which would create a severely negative prog range.
     * To fix this, we check the Filter (playerStats array) created earlier to see if there are more than 2 objects in the array. If there are, we average the PER values from the 2 objects.
     * Edits must be made to handle players traded more than once mid-season.
     */
    if (playerStats.length > 1) {
      per = Math.fround((playerStats[0].per + playerStats[1].per) / 2);
    }
    // 1 Stat object, no need to average; just grab the PER value from the object
    else if (playerStats.length === 1) {
      per = Math.fround(playerStats[0].per);
    }
    // Viewable from using Inspect Element in the browser - TODO: add BBGM notifications.
    console.log(
      `----\n${name}:\nSeason: ${seasonYr}\nPER: ${per}\nStat PERs: 1: ${
        playerStats[0]?.per || "N/A"
      } || 2: ${playerStats[1]?.per || "N/A"}\nStat TIDs: ${recentStats}\n----`
    );
    // Determine player age
    const age = bbgm.g.get("season") - p.born.year;
    // Declare variable to be used later
    let progRange = [0, 0];
    if (p.ratings.length > 1) {
      p.ratings.pop();
      bbgm.player.addRatingsRow(p);
      const ratings = p.ratings.at(-1);
      // 26 to 30
      if (age > 25 && age < 31) {
        progRange = [per / 5 - 7, per / 4 - 1];
        progRange = progRange.map((value) => Math.round(value));
        console.log(`${name}:\nPER: ${per}\nProg Range: ${progRange} [25-30]`);
      }
      // 31 to 34
      else if (age >= 31 && age < 35) {
        progRange = [per / 6 - 7, per / 4 - 2];
        progRange = progRange.map((value) => Math.round(value));
        console.log(`${name}:\nPER: ${per}\nProg Range: ${progRange} [31-35]`);
      }
      // 35 and beyond
      else if (age >= 35) {
        progRange = [per / 6 - 8, per / 7 - 1];
        progRange = progRange.map((value) => Math.round(value));
        console.log(`${name}:\nPER: ${per}\nProg Range: ${progRange} [35+]`);
      }
      const keys = [
        "diq",
        "dnk",
        "drb",
        "endu",
        "fg",
        "ft",
        "ins",
        "jmp",
        "oiq",
        "pss",
        "reb",
        "spd",
        "stre",
        "tp",
      ];
      for (const key of keys) {
        const prog = bbgm.random.randInt(...progRange);
        ratings[key] = bbgm.player.limitRating(ratings[key] + prog);
      }
      await bbgm.player.develop(p, 0);
      await bbgm.player.updateValues(p);
      await bbgm.idb.cache.players.put(p);
    }
  }
}
