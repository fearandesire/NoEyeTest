/**
 * @fileoverview
 * NoEyeTest: BBGM Prog Script | v.2.0.0
 * This script is used to calculate the 'Prog Range' (PR) for a player.
 * A prog range is how low, or high high a player can progress in the off-season.
 * The prog range is calculated by taking the player's PER from the previous season
 * Currently, this is designed for players 25+.
 *
 * Credits to TheProgMaestro for the original code this stemmed from, which I have now modified to create my own distirbution of it.
 */

/**
 * Creates a notification into the game's log.
 * @function sendProgNotification
 * @param {number} pid - Player ID
 * @param {string} notiMsg - Notification Message
 */
async function sendProgNotification(player, progRange, ageRange, per, godProg) {
  if (!player) {
    return;
  }
  const { pid, firstName, lastName, born, tid } = player;
  if (!pid) {
    return;
  }
  const notiTitle = godProg ? "God Progged!<br/>Prog Info:" : "Prog Info:";
  const ageRangeFull = ageRange || `N/A`;
  const perFull = per ? per.toFixed(2) : `N/A`;
  await bbgm.idb.cache.players.put(player);
  await bbgm.logEvent({
    type: "Progs",
    text: `<a href="${bbgm.helpers.leagueUrl([
      "player",
      pid,
    ])}">\n${firstName} ${lastName} ${notiTitle}</a><br/><b>Range:</b> ${JSON.stringify(
      progRange
    )}<br/><b>
        PER:
        </b> ${perFull}<br/><b>
        Age Group:
        </b> ${ageRangeFull}`,
    showNotification: true,
    pids: [pid],
    tids: [tid],
    persistent: false,
    score: 20,
  });
}
let godProgCount = 0;
let god;
async function runProgs() {
  const players = await bbgm.idb.cache.players.getAll(); // Collect all players in the game via the cache.
  const SZN = bbgm.g.get("season");
  const seasonYr = SZN - 1;
  const notification = sendProgNotification;

  for await (const p of players) {
    const ageFlags = {};
    ageFlags.thirty = false;
    ageFlags.twentySix = false;

    if (p.note !== "classic" && p.draft.year !== seasonYr) {
      const name = `${p.firstName} ${p.lastName}`;
      let per = 0;
      const playerStats = p.stats.filter(
        (stat) => stat.season === seasonYr && stat.per !== 0 && !stat.playoffs
      );

      if (playerStats.length > 0) {
        per =
          playerStats.reduce((sum, stat) => sum + stat.per, 0) /
          playerStats.length;
      }

      if (playerStats.length > 1) {
        per = Math.fround((playerStats[0].per + playerStats[1].per) / 2);
      } else if (playerStats.length === 1) {
        per = Math.fround(playerStats[0].per);
      }

      // # Players with 0 PER should receive normal BBGM progs.
      if (per === 0) {
        await notification(
          p.pid,
          "No PER found. Skipped altering their progs."
        );
        continue;
      }
      // ? Determine player age
      const age = SZN - p.born.year;
      // ? Declare variable to be used later
      let progRange = [0, 0];
      if (p.ratings.length > 1) {
        p.ratings.pop();
        bbgm.player.addRatingsRow(p);
        const ratings = p.ratings.at(-1);
        // ? 26-29
        if (age > 25 && age < 30) {
          ageFlags.twentySix = true;
          // ? 30+
        } else if (age >= 30) {
          ageFlags.thirty = true;
        }

        // # 26 to 30
        if (age > 25 && age < 31) {
          progRange = [per / 5 - 7, per / 4 - 1];
          progRange = progRange.map((value) => Math.round(value));
          await notification(p, progRange, "26-30", per);
        }

        // # 31 to 34
        else if (age >= 31 && age < 35) {
          progRange = [per / 6 - 7, per / 4 - 2];
          progRange = progRange.map((value) => Math.round(value));
          await notification(p, progRange, "31-35", per);
        }

        // # 35 and beyond
        else if (age >= 35) {
          progRange = [per / 6 - 8, per / 7 - 1];
          progRange = progRange.map((value) => Math.round(value));
          await notification(p, progRange, "35+", per);
        }

        // # God Progs for players under 29
        if (age < 29) {
          // Customize the chance of getting a "God Prog" | Chance should be random between 0.01 and 0.05
          godProgChance = Math.random() * 0.06 + 0.01;
          if (Math.random() < godProgChance) {
            const minGodProg = 7;
            const maxGodProg = 15;
            const randProg =
              Math.floor(Math.random() * maxGodProg) + minGodProg;
            progRange = [randProg, randProg];
            await notification(p, progRange, "< 29", per, true);
            godProgCount += 1;
          }
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
        let prog;
        let oldAgeKeys = [`spd`, `stre`, `jmp`, `endu`];
        let midAgeKeys = [`spd`, `stre`, `jmp`];
        for await (const key of keys) {
          // # 30 y/os: Control chance of progging physical skills
          if (ageFlags.thirty && oldAgeKeys.includes(key) && progRange[0] > 0) {
            // # Provide anywhere between a 1 - 5% chance to prog a physical skill
            const oldProgPhys = Math.random() * 0.06 + 0.01;
            if (Math.random() < oldProgPhys) {
              // # Limit the highest of either prog in the progRange property to 3
              if (progRange[1] > 3) {
                progRange[1] = 3;
              } else if (progRange[0] > 3) {
                progRange[0] = 3;
              }
            } else {
              continue;
            }
          }
          prog = bbgm.random.randInt(...progRange);

          // ? A specific skill receiving a prog of 5 or more has a 30% chance of being changed
          if (prog >= 5) {
            if (Math.random() < 0.3) {
              prog = randomNum(1, 5);
            }
          }

          // ? Players age 26 start with a 70% chance to progress `spd`, `stre` and `jmp` skills. This chance decreases with age to
          if (ageFlags.twentySix && midAgeKeys.includes(key) && prog > 0) {
            // Decreasing linear function for age 26 to 29
            const ageFactor = 0.7 - (age - 26) * 0.1;
            const probProgression = Math.max(ageFactor, 0.2);
            if (Math.random() > probProgression) {
              continue;
            }
          }

          ratings[key] = bbgm.player.limitRating(ratings[key] + prog);
        }

        await bbgm.player.develop(p, 0);
        await bbgm.player.updateValues(p);
        await bbgm.idb.cache.players.put(p);
      }
    }
  }
}

function randomNum(a, b) {
  return Math.floor(Math.random() * b) + a;
}

const logGodProgs = async () => {
  await bbgm.logEvent({
    type: `God Progs`,
    text: `God Prog Count This Run: ${godProgCount}`,
    showNotification: true,
    persistent: false,
    score: 20,
    pids: [0],
  });
};

await runProgs(); // Run the script
await logGodProgs(); // Log the number of God Progs
