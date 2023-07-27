/**
 * @fileoverview
 * NoEyeTest: BBGM Prog Script | v.3.1.0
 * This script is used to calculate the 'Prog Range' (PR) for a player.
 * A prog range is how low, or high high a player can progress in the off-season.
 * The prog range is calculated by taking the player's PER from the previous season
 * Currently, this is designed for players 25+
 * Please see the README on how to use this
 *
 * Credits to TheProgMaestro for the original code this stemmed from, which I have now modified to create my own distirbution of it.
 */

/**
 * Creates a notification into the game's log.
 * @function sendProgNotification
 * @param {number} pid - Player ID
 * @param {string} notiMsg - Notification Message
 */
async function sendProgNotification(data) {
	let { player, progRange, ageRange, per, godProg, ovr } = data || null;
	const SZN = bbgm.g.get('season');
	const seasonYr = SZN - 1;
	if (!player) {
		return;
	}
	const { pid, firstName, lastName, born, tid } = player;
	if (!pid) {
		return;
	}
	const notiTitle = godProg ? 'God Progged!<br/>Prog Info:' : 'Prog Info:';
	const ageRangeFull = ageRange || `N/A`;
	const perFull = per ? per.toFixed(2) : `N/A`;
	await bbgm.idb.cache.players.put(player);
	await bbgm.logEvent({
		type: 'Progs',
		text: `<a href="${bbgm.helpers.leagueUrl([
			'player',
			pid,
		])}">\n${firstName} ${lastName} ${notiTitle}</a><br/><b>Range:</b> ${JSON.stringify(
			progRange,
		)}<br/><b>
        PER:
        </b> ${perFull}<br/><b>
        Age Group:
    </b> ${ageRangeFull}<br/>OVR: ${ovr}<br/><b>${seasonYr}</b>`,
		showNotification: true,
		pids: [pid],
		tids: [tid],
		persistent: false,
		score: 20,
	});
}

// From: https://stackoverflow.com/questions/4959975/generate-random-number-between-two-numbers-in-javascript
function randomInt(min, max) {
	return Math.floor(Math.random() * (max - min + 1) + min);
}

function getProgRange(per, progOptions, restrictions) {
	let min = 0;
	let max = 0;
	const { min1, min2, max1, max2, hardMin, hardMax, ovr, age } =
		progOptions || {};

	if (per <= 20 && age < 31) {
		min = Math.ceil(per / 5) - 6;
		max = Math.ceil(per / 4) - 1;
	} else {
		min = Math.ceil(per / min1) - min2;
		max = Math.ceil(per / max1) - max2 || 2;
	}

	if (hardMin) {
		min = hardMin;
	}
	if ((hardMax && max > hardMax) || max > hardMax) {
		max = hardMax;
	}

	// ! Ensure player doesn't pass OVR cap
	const ovrProgression = max + ovr;
	const flagLower = min + ovr;
	// Catch progs that would take them over 80
	if (ovrProgression >= 80) {
		let eq;
		if (ovr >= 80) {
			max = 0;
			if (age > 30 && age < 35) {
				min = -10;
			}
			if (age >= 35) {
				min = -14;
			}
			if (age <= 30) {
				const randomMin = randomInt(-2, 0);
				if (randomMin < 0.02) {
					min = -2;
				}
			}
			if (min > max) {
				min = 0;
			}
		} else {
			const diff = 80 - ovr;
			// # Make the progRanges are whatever number it takes to get them to 80 based on their ovr
			max = diff;
			if (flagLower >= 80) {
				min = 0;
			}
		}
	}

	const progRange = [min, max];
	return progRange;
}

let godProgCount = 0;
let god;

function getAgeRange(age) {
	if (age >= 25 && age <= 30) {
		return '25-30';
	} else if (age >= 31 && age <= 34) {
		return '31-34';
	} else {
		return '35+';
	}
}
async function compileProgs() {
	const players = await bbgm.idb.cache.players.getAll(); // Collect all players in the game via the cache.
	const SZN = bbgm.g.get('season');
	const seasonYr = SZN - 1;
	const notification = sendProgNotification;

	for await (const p of players) {
		const ageFlags = {};
		ageFlags.thirty = false;
		ageFlags.twentyFive = false;
		const name = `${p.firstName} ${p.lastName}`;
		if (p.note === 'balanced' && p.draft.year !== seasonYr) {
			const name = `${p.firstName} ${p.lastName}`;
			let per = 0;
			let ovr = 0;
			const playerStats = p.stats.filter(
				(stat) =>
					stat.season === seasonYr &&
					stat.per !== 0 &&
					!stat.playoffs,
			);

			if (playerStats.length > 0) {
				per =
					playerStats.reduce((sum, stat) => sum + stat.per, 0) /
					playerStats.length;
			}

			if (playerStats.length > 1) {
				const totalPer = playerStats.reduce(
					(sum, stat) => sum + stat.per,
					0,
				);
				per = totalPer / playerStats.length;
			} else if (playerStats.length === 1) {
				per = Math.fround(playerStats[0].per);
			}

			// # Players with 0 PER should receive normal BBGM progs.
			if (per === 0) {
				await notification({
					player: p.pid,
					progRange: 'No PER located - Used BBGM Progs',
				});
				continue;
			}
			// ? Determine player age
			const age = SZN - p.born.year;
			let ageRange;
			ageRange = getAgeRange(age);
			// ? Declare variable to be used later
			let progRange = [0, 0];
			if (p.ratings.length > 1) {
				p.ratings.pop();
				bbgm.player.addRatingsRow(p);
				const ratings = p.ratings.at(-1);

				ovr = ratings.ovr;

				// ? Flags to control what age group a player falls into.
				// ? Currently, these flags are used to restrict specific skills from leveling if the player is of a certain age
				if (age >= 25 && age < 30) {
					ageFlags.twentyFive = true;
					// ? 30+
				} else if (age >= 30) {
					ageFlags.thirty = true;
				}

				const minMaxes = {
					'25-30': {
						min1: 5,
						min2: 7,
						max1: 4,
						max2: 2,
						hardMax: 4,
					},
					'31-34': {
						min1: 6,
						min2: 7,
						max1: 4,
						max2: 3,
						hardMax: 2,
					},
					'35+': { min1: 6, min2: 9, hardMax: 0 },
				};

				let progRange = [0, 0];
				async function progs(data) {
					const { age, per, ovr, name } = data;
					if (ageRange === '25-30') {
						const { min1, min2, max1, max2, hardMax } =
							minMaxes[ageRange];
						progRange = getProgRange(per, {
							min1,
							min2,
							max1,
							max2,
							hardMax,
							ovr,
							age,
						});
					} else if (ageRange === '31-34') {
						const { min1, min2, max1, max2, hardMax } =
							minMaxes[ageRange];
						progRange = getProgRange(per, {
							min1,
							min2,
							max1,
							max2,
							hardMax,
							ovr,
							age,
						});
					} else if (ageRange === '35+') {
						const { min1, min2, hardMax } = minMaxes[ageRange];
						progRange = getProgRange(per, {
							min1: 6,
							min2: 9,
							hardMax: 0,
							ovr,
							age,
						});
					}
					await notification({
						player: p,
						progRange,
						ageRange,
						per,
						ovr,
						age,
					});
					return progRange;
				}
				// # Init Progs
				progRange = await progs({
					age,
					per,
					ovr,
					name,
				});

				// ! Section: God Progs
				if (age < 30) {
					let godProgChance;
					// Minimum and maximum overall rating for scaling chance
					const MIN_RATING = 30;
					const MAX_RATING = 61;
					// Maximum godProgChance values
					const MAX_CHANCE = 0.09;

					// Calculate the scaling factor based on the ovr value
					let scalingFactor;
					if (ovr < MIN_RATING) {
						scalingFactor = 1.0;
					} else if (ovr > MAX_RATING) {
						scalingFactor = 0.01;
					} else {
						scalingFactor =
							1.0 -
							(ovr - MIN_RATING) / (MAX_RATING - MIN_RATING);
					}

					// # Calculate the godProgChance using the scaling factor
					godProgChance = scalingFactor * MAX_CHANCE;

					if (Math.random() < godProgChance) {
						const minGodProg = 7;
						const maxGodProg = 13;
						const randProg =
							Math.floor(
								Math.random() * (maxGodProg - minGodProg),
							) + minGodProg;
						progRange = [randProg, randProg];
						await notification({
							player: p,
							progRange,
							ageRange,
							per,
							ovr,
							godProg: true,
						});
						godProgCount += 1;
					}
				}

				// ! Section: Prog Stats Control

				// # Control which stats get progressed
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
				for await (const key of keys) {
					// # Restrict 30+ yr old players physical skill progs
					if (
						ageFlags.thirty &&
						oldAgeKeys.includes(key) &&
						progRange[1] > 0
					) {
						// # Provide anywhere between a 1 - 5% chance to prog a physical skill
						const oldProgPhys = Math.random() * 0.05 + 0.01;
						if (Math.random() < oldProgPhys) {
							// # If older players get the chance to prog a physical skill, cap the progression of said skill to 3
							if (progRange[1] > 3) {
								progRange[1] = 3;
							} else {
								continue;
							}
						}
					}

					// ? Prog the player stats
					prog = bbgm.random.randInt(...progRange);
					// # Players 25+ will have 70% chance to progress `spd`, `stre` and `jmp` skills.
					if (
						ageFlags.twentyFive &&
						midAgeKeys.includes(key) &&
						prog > 0
					) {
						// ? Decreasing linear function - Reduce the chance of progressing `spd`, `stre` and `jmp` as they age
						const ageFactor = 0.7 - (age - 25) * 0.1;
						// ? 30+ will have a 0% chance
						const probProgression = Math.max(ageFactor, 0);
						if (Math.random() > probProgression) {
							continue;
						}
					}

					// ! Apply the prog - Updates the skill with the prog
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

await compileProgs(); // Run the script
await logGodProgs(); // Log the number of God Progs
