/**
 * NoEyeTest: BBGM Prog Script
 * This script is used to calculate the 'Prog Range' (PR) for a player.
 * A prog range is how low, or high high a player can progress in the off-season.
 * The prog range is calculated by taking the player's PER from the previous season
 * Currently, this is designed for players 25+.
 *
 * Credits to TheProgMaestro for the original code this stemmed from, which I have now modified to create my own distirbution of it.
 */

/**
 * @function customNotification
 * @param {number} pid - Player ID
 * @param {string} notiMsg - Notification Message
 *
 * Credit to TheProgMaestro for this function. Minimal change here, saved me time reading on the notification system myself.
 */
async function customNotification(pid, notiMsg) {
    const p = await bbgm.idb.cache.players.get(pid);
    const { tid } = p;
    await bbgm.idb.cache.players.put(p);
    await bbgm.logEvent({
        type: 'Progs',
        text: `<a href="${bbgm.helpers.leagueUrl([
            'player',
            p.pid,
        ])}">${p.firstName} ${
            p.lastName
        }</a> Prog Details:<br/>${notiMsg}.`,
        showNotification: true,
        pids: [p.pid],
        tids: [tid],
        persistent: false,
        score: 20,
    });
}
/* global bbgm */ // Disable eslint error for referencing bbgm's cache system, it's defined in the BBGM codebase.
async function runProgs() {
    const players = await bbgm.idb.cache.players.getAll(); // Collect all players in the game via the cache.
    const seasonYr = 2013; //! MUST be changed before running progs to match the prior season year
    const notification = customNotification;
    const ageFlags = {};
    ageFlags.thirty = false;
    ageFlags.twentySix = false;
    // Iterate through the players
    for await (const p of players) {
        // Only control progs for players that do not have the 'classic' note on them;
        // Fixed: Ignore rookie players by checking the draftYear.
        if (p.note !== 'classic' && p.draft.year !== seasonYr) {
            const name = `${p.firstName} ${p.lastName}`;
            let per = 0;
            // Filter (into an array) the stats for the player that meet our criteria: Last season, non-playoffs, and there has to be a PER value (this is to avoid grabbing the most recent season's stats, which, at the time of progs, will be completely empty)
            const playerStats = p.stats.filter(
                (stat) =>
                    stat.season === seasonYr &&
                    stat.per !== 0 &&
                    !stat.playoffs
            );
            /**
             * Every season creates 1 object to collect stats in for the player.
             * If the player is traded mid-season, there will be duplicate object to collect stats for the player relating to the new team, but for the same season.
             * This originally created an issue with the script, as PER was being grabbed incorrectly, or even worse, resulting in a NaN or 0 value, which would create a severely negative prog range.
             * To fix this, we check the Filter (playerStats array) created earlier to see if there are more than 2 (stats) objects in the array. If so, we average the PER values from the 2 objects.
             * Edits must be made to handle players traded more than once mid-season.
             */
            if (playerStats.length > 1) {
                per = Math.fround(
                    (playerStats[0].per + playerStats[1].per) / 2
                );
            }

            // 1 Stat object, no need to average; just grab the PER value from the object
            else if (playerStats.length === 1) {
                per = Math.fround(playerStats[0].per);
            }
            // # Players with 0 PER should receive normal BBGM progs as a fallback.
            if (per === 0) {
                await notification(
                    p.pid,
                    'No PER found. Skipped altering their progs.'
                );
                continue;
            }
            // ? Determine player age
            const age = bbgm.g.get('season') - p.born.year;
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
                    progRange = progRange.map((value) =>
                        Math.round(value)
                    );
                    await notification(
                        p.pid,
                        `PER: ${per.toFixed(
                            2
                        )}<br/>Prog Range: ${progRange} [25-30]`
                    );
                }

                // # 31 to 34
                else if (age >= 31 && age < 35) {
                    progRange = [per / 6 - 7, per / 4 - 2];
                    progRange = progRange.map((value) =>
                        Math.round(value)
                    );
                    await console.log(
                        `${name}:\nPER: ${per}\nProg Range: ${progRange} [31-35]`
                    );
                    await notification(
                        p.pid,
                        `PER: ${per.toFixed(
                            2
                        )}<br/>Prog Range: ${progRange} [31-35]`
                    );
                }

                // # 35 and beyond
                else if (age >= 35) {
                    progRange = [per / 6 - 8, per / 7 - 1];
                    progRange = progRange.map((value) =>
                        Math.round(value)
                    );
                    await notification(
                        p.pid,
                        `PER: ${per.toFixed(
                            2
                        )}<br/>Prog Range: ${progRange} [35+]`
                    );
                }
                const keys = [
                    'diq',
                    'dnk',
                    'drb',
                    'endu',
                    'fg',
                    'ft',
                    'ins',
                    'jmp',
                    'oiq',
                    'pss',
                    'reb',
                    'spd',
                    'stre',
                    'tp',
                ];
                let prog;
                let oldAgeKeys = [`spd`, `stre`, `jmp`, `endu`];
                let midAgeKeys = [`spd`, `stre`, `jmp`];
                for (const key of keys) {
                    // # If the player's `progRange` highest number is 5 or above, randomly select skils to not progress
                    if (progRange[1] >= 5) {
                        if (Math.random() < 0.5) {
                            continue;
                        }
                    }
                    // ? 30+ yr olds can't progress 'spd', 'stre', 'jmp', or 'endu' skills
                    if (ageFlags.thirty && oldAgeKeys.includes(key)) {
                        continue;
                        // ? Restrict the same as 'oldAgeKeys' except `endu` (endurance) for 26-29 yr olds
                    } else if (
                        ageFlags.twentySix &&
                        midAgeKeys.includes(key)
                    ) {
                        // # Use a number between 0 and 1
                        prog = Math.random();
                    } else {
                        prog = bbgm.random.randInt(...progRange);
                    }
                    ratings[key] = bbgm.player.limitRating(
                        ratings[key] + prog
                    );
                }
                await bbgm.player.develop(p, 0);
                await bbgm.player.updateValues(p);
                await bbgm.idb.cache.players.put(p);
            }
        }
    }
}

await runProgs(); // Run the script
