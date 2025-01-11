/**
 * NoEyeTest: BBGM Prog Script | v3.2.0
 * This script is used to calculate the 'Prog Range' (PR) for a player, and adjust their progs accordingly.
 * A prog range is how low or high a player can progress in the off-season.
 * The prog range is calculated by taking the player's PER from the previous season
 * Currently, this is designed for players 26+
 * Please see the README on how to use this
 */

/**
 * @typedef {Object} ProgOptions
 * @property {number} min1 - First minimum divisor for progression calculation
 * @property {number} min2 - Second minimum subtractor for progression calculation
 * @property {number} max1 - First maximum divisor for progression calculation
 * @property {number} max2 - Second maximum subtractor for progression calculation
 * @property {number} hardMax - Maximum possible progression value
 * @property {number} [hardMin] - Minimum possible progression value
 * @property {number} ovr - Player's overall rating
 * @property {number} age - Player's age
 */

/**
 * Configuration class containing static constants for the progression system.
 * @class
 */
class Config {
	/** @type {Object.<string, string>} Age range definitions for player categorization */
	static AGE_RANGES = {
		YOUNG: '25-30',
		MID: '31-34',
		OLD: '35+',
	};

	/** @type {Object.<string, number>} Progression system limits and thresholds */
	static PROGRESSION_LIMITS = {
		MAX_OVR: 80,
		MIN_RATING: 30,
		MAX_RATING: 61,
		MAX_GOD_PROG_CHANCE: 0.09,
		MIN_GOD_PROG: 7,
		MAX_GOD_PROG: 13,
	};

	/**
	 *  Used to control which skills are affected by NET prog adjustments
	 *  @type {Object.<string, string[]>} Player skill attributes categorized by type
	 *  */
	static SKILL_KEYS = {
		ALL: [
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
		],
		PHYSICAL_OLD: ['spd', 'stre', 'jmp', 'endu'],
		PHYSICAL_MID: ['spd', 'stre', 'jmp'],
	};

	/** @type {Object.<string, ProgOptions>} Progression ranges for different age groups */
	static PROG_RANGES = {
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
		'35+': {
			min1: 6,
			min2: 9,
			hardMax: 0,
		},
	};
}

/**
 * Service class for handling BBGM notifications and logging events.
 * @class
 */
class NotificationService {
	/**
	 * Sends a progression notification for a player.
	 * @param {Object} data - The notification data
	 * @param {Object} data.player - Player object containing pid, firstName, lastName, and tid
	 * @param {Array<number>} data.progRange - The progression range [min, max]
	 * @param {string} data.ageRange - The age category of the player
	 * @param {number} data.per - Player Efficiency Rating
	 * @param {boolean} data.godProg - Whether the player achieved a "god prog"
	 * @param {number} data.ovr - Player's overall rating
	 * @returns {Promise<void>}
	 */
	static async sendProgNotification(data) {
		const { player, progRange, ageRange, per, godProg, ovr } = data || {};
		const SZN = bbgm.g.get('season');
		const seasonYr = SZN - 1;

		if (!player || !player.pid) return;

		const { pid, firstName, lastName, tid } = player;
		const notiTitle = godProg ? 'God Progged!<br/>Prog Info:' : 'Prog Info:';
		const ageRangeFull = ageRange || 'N/A';
		const perFull = per ? per.toFixed(2) : 'N/A';

		await bbgm.idb.cache.players.put(player);
		await bbgm.logEvent({
			type: 'Progs',
			text: `<a href="${bbgm.helpers.leagueUrl(['player', pid])}">\n${firstName} ${lastName} ${notiTitle}</a><br/><b>Range:</b> ${JSON.stringify(progRange)}<br/><b>PER:</b> ${perFull}<br/><b>Age Group:</b> ${ageRangeFull}<br/>OVR: ${ovr}<br/><b>${seasonYr}</b>`,
			showNotification: true,
			pids: [pid],
			tids: [tid],
			persistent: false,
			score: 20,
		});
	}

	/**
	 * Logs the total count of god progs for the current run.
	 * @param {number} count - Number of god progs achieved
	 * @returns {Promise<void>}
	 */
	static async logGodProgs(count) {
		await bbgm.logEvent({
			type: 'God Progs',
			text: `God Prog Count This Run: ${count}`,
			showNotification: true,
			persistent: false,
			score: 20,
			pids: [0],
		});
	}
}

/**
 * Utility class providing helper functions for the progression system.
 * @class
 */
class Utils {
	/**
	 * Generates a random integer between min and max (inclusive).
	 * @param {number} min - Minimum value
	 * @param {number} max - Maximum value
	 * @returns {number} Random integer between min and max
	 */
	static randomInt(min, max) {
		return Math.floor(Math.random() * (max - min + 1) + min);
	}

	/**
	 * Determines the age range category for a player.
	 * @param {number} age - Player's age
	 * @returns {string} Age range category
	 */
	static getAgeRange(age) {
		if (age >= 25 && age <= 30) return Config.AGE_RANGES.YOUNG;
		if (age >= 31 && age <= 34) return Config.AGE_RANGES.MID;
		return Config.AGE_RANGES.OLD;
	}

	/**
	 * Calculates the average PER from player stats.
	 * @param {Array<Object>} playerStats - Array of player stat objects
	 * @returns {number} Average PER or 0 if no stats
	 */
	static calculatePER(playerStats) {
		if (playerStats.length === 0) return 0;
		const totalPer = playerStats.reduce((sum, stat) => sum + stat.per, 0);
		return playerStats.length === 1
			? Math.fround(playerStats[0].per)
			: totalPer / playerStats.length;
	}
}

/**
 * Calculator class for determining player progression ranges.
 * @class
 */
class ProgressionCalculator {
	/**
	 * Calculates the progression range based on PER and other factors.
	 * @param {number} per - Player Efficiency Rating
	 * @param {ProgOptions} progOptions - Progression options and limits
	 * @returns {Array<number>} Progression range [min, max]
	 */
	static getProgRange(per, progOptions) {
		let min;
		let max;
		const { min1, min2, max1, max2, hardMin, hardMax, ovr, age } =
			progOptions || {};

		if (per <= 20 && age < 31) {
			min = Math.ceil(per / 5) - 6;
			max = Math.ceil(per / 4) - 1;
		} else {
			min = Math.ceil(per / min1) - min2;
			max = Math.ceil(per / max1) - max2 || 2;
		}

		if (hardMin) min = hardMin;
		if ((hardMax && max > hardMax) || max > hardMax) max = hardMax;

		return ProgressionCalculator.adjustForOVRCap(min, max, ovr, age);
	}

	/**
	 * Adjusts progression range based on overall rating cap.
	 * @param {number} min - Minimum progression value
	 * @param {number} max - Maximum progression value
	 * @param {number} ovr - Player's overall rating
	 * @param {number} age - Player's age
	 * @returns {Array<number>} Adjusted progression range [min, max]
	 */
	static adjustForOVRCap(min, max, ovr, age) {
		let adjustedMin = min;
		let adjustedMax = max;
		const ovrProgression = adjustedMax + ovr;
		const flagLower = adjustedMin + ovr;

		if (ovrProgression >= Config.PROGRESSION_LIMITS.MAX_OVR) {
			if (ovr >= Config.PROGRESSION_LIMITS.MAX_OVR) {
				adjustedMax = 0;
				if (age > 30 && age < 35) adjustedMin = -10;
				if (age >= 35) adjustedMin = -14;
				if (age <= 30) {
					const randomMin = Utils.randomInt(-2, 0);
					if (randomMin < 0.02) adjustedMin = -2;
				}
				if (adjustedMin > adjustedMax) adjustedMin = 0;
			} else {
				adjustedMax = Config.PROGRESSION_LIMITS.MAX_OVR - ovr;
				if (flagLower >= Config.PROGRESSION_LIMITS.MAX_OVR) adjustedMin = 0;
			}
		}

		return [adjustedMin, adjustedMax];
	}
}

/**
 * System for handling exceptional player progressions ("god progs").
 * @class
 */
class GodProgSystem {
	/** @type {number} Counter for god progs in current run */
	static godProgCount = 0;

	/**
	 * Calculates the chance of a god prog based on overall rating.
	 * @param {number} ovr - Player's overall rating
	 * @returns {number} Probability of god prog (0-1)
	 */
	static calculateGodProgChance(ovr) {
		const { MIN_RATING, MAX_RATING, MAX_GOD_PROG_CHANCE } =
			Config.PROGRESSION_LIMITS;
		let scalingFactor;

		if (ovr < MIN_RATING) {
			scalingFactor = 1.0;
		} else if (ovr > MAX_RATING) {
			scalingFactor = 0.01;
		} else {
			scalingFactor = 1.0 - (ovr - MIN_RATING) / (MAX_RATING - MIN_RATING);
		}

		return scalingFactor * MAX_GOD_PROG_CHANCE;
	}

	/**
	 * Determines if a player achieves a god prog.
	 * @param {number} age - Player's age
	 * @param {number} ovr - Player's overall rating
	 * @returns {Array<number>|null} God prog range or null if not achieved
	 */
	static godProg(age, ovr) {
		if (age >= 30) return null;

		const godProgChance = GodProgSystem.calculateGodProgChance(ovr);
		if (Math.random() >= godProgChance) return null;

		const { MIN_GOD_PROG, MAX_GOD_PROG } = Config.PROGRESSION_LIMITS;
		const randProg = Utils.randomInt(MIN_GOD_PROG, MAX_GOD_PROG);
		GodProgSystem.godProgCount++;

		return [randProg, randProg];
	}
}

/**
 * Main system for handling player progression calculations and applications.
 * @class
 */
class PlayerProgressionSystem {
	/**
	 * Creates a new PlayerProgressionSystem instance.
	 */
	constructor() {
		/** @type {typeof NotificationService} */
		this.notificationService = NotificationService;
	}

	/**
	 * Processes progression for a single player.
	 * @param {Object} player - Player object from BBGM
	 * @param {number} seasonYr - Current season year
	 * @returns {Promise<void>}
	 */
	async processPlayer(player, seasonYr) {
		if (player.watch !== 1 || player.draft.year === seasonYr) return;

		const playerStats = player.stats.filter(
			(stat) => stat.season === seasonYr && stat.per !== 0 && !stat.playoffs,
		);

		const per = Utils.calculatePER(playerStats);
		if (per === 0) {
			await this.notificationService.sendProgNotification({
				player: player.pid,
				progRange: 'No PER located - Used BBGM Progs',
			});
			return;
		}

		const age = bbgm.g.get('season') - player.born.year;
		const ageRange = Utils.getAgeRange(age);

		if (player.ratings.length <= 1) return;

		player.ratings.pop();
		bbgm.player.addRatingsRow(player);
		const ratings = player.ratings.at(-1);
		const ovr = ratings.ovr;

		const progRange = await this.calculateProgression(
			player,
			age,
			per,
			ovr,
			ageRange,
		);
		await this.applyProgressions(player, ratings, progRange, age);

		await this.finalizePlayer(player);
	}

	/**
	 * Calculates progression values for a player.
	 * @param {Object} player - Player object
	 * @param {number} age - Player's age
	 * @param {number} per - Player Efficiency Rating
	 * @param {number} ovr - Player's overall rating
	 * @param {string} ageRange - Player's age category
	 * @returns {Promise<Array<number>>} Progression range [min, max]
	 */
	async calculateProgression(player, age, per, ovr, ageRange) {
		const progConfig = Config.PROG_RANGES[ageRange];
		let progRange = ProgressionCalculator.getProgRange(per, {
			...progConfig,
			ovr,
			age,
		});

		const godProgRange = GodProgSystem.godProg(age, ovr);
		if (godProgRange) {
			progRange = godProgRange;
			await this.notificationService.sendProgNotification({
				player,
				progRange,
				ageRange,
				per,
				ovr,
				godProg: true,
			});
		} else {
			await this.notificationService.sendProgNotification({
				player,
				progRange,
				ageRange,
				per,
				ovr,
			});
		}

		return progRange;
	}

	/**
	 * Applies progression values to player ratings.
	 * @param {Object} player - Player object
	 * @param {Object} ratings - Player ratings object
	 * @param {Array<number>} progRange - Progression range [min, max]
	 * @param {number} age - Player's age
	 * @returns {Promise<void>}
	 */
	async applyProgressions(player, ratings, progRange, age) {
		const ageFlags = {
			thirty: age >= 30,
			twentyFive: age >= 25 && age < 30,
		};

		for (const key of Config.SKILL_KEYS.ALL) {
			if (await this.shouldSkipProgression(key, ageFlags, progRange)) continue;

			const prog = bbgm.random.randInt(...progRange);
			if (await this.shouldSkipPhysicalProgression(key, ageFlags, prog, age))
				continue;

			ratings[key] = bbgm.player.limitRating(ratings[key] + prog);
		}
	}

	/**
	 * Checks if progression should be skipped for a skill.
	 * @param {string} key - Skill key
	 * @param {Object} ageFlags - Age-related flags
	 * @param {Array<number>} progRange - Progression range
	 * @returns {Promise<boolean>} Whether to skip progression
	 */
	async shouldSkipProgression(key, ageFlags, progRange) {
		if (
			!ageFlags.thirty ||
			!Config.SKILL_KEYS.PHYSICAL_OLD.includes(key) ||
			progRange[1] <= 0
		) {
			return false;
		}

		const oldProgPhys = Math.random() * 0.05 + 0.01;
		if (Math.random() >= oldProgPhys) return true;

		if (progRange[1] > 3) progRange[1] = 3;
		return false;
	}

	/**
	 * Checks if physical progression should be skipped.
	 * @param {string} key - Skill key
	 * @param {Object} ageFlags - Age-related flags
	 * @param {number} prog - Progression value
	 * @param {number} age - Player's age
	 * @returns {Promise<boolean>} Whether to skip physical progression
	 */
	async shouldSkipPhysicalProgression(key, ageFlags, prog, age) {
		if (
			!ageFlags.twentyFive ||
			!Config.SKILL_KEYS.PHYSICAL_MID.includes(key) ||
			prog <= 0
		) {
			return false;
		}

		const ageFactor = 0.7 - (age - 25) * 0.1;
		const probProgression = Math.max(ageFactor, 0);
		return Math.random() > probProgression;
	}

	/**
	 * Finalizes player updates after progression.
	 * @param {Object} player - Player object
	 * @returns {Promise<void>}
	 */
	async finalizePlayer(player) {
		await bbgm.player.develop(player, 0);
		await bbgm.player.updateValues(player);
		await bbgm.idb.cache.players.put(player);
	}
}

/**
 * Compiles and applies progressions for all players.
 * @returns {Promise<void>}
 */
async function compileProgs() {
	const players = await bbgm.idb.cache.players.getAll();
	const seasonYr = bbgm.g.get('season') - 1;
	const progressionSystem = new PlayerProgressionSystem();

	for (const player of players) {
		await progressionSystem.processPlayer(player, seasonYr);
	}
}

// Run the script
await compileProgs();
await NotificationService.logGodProgs(GodProgSystem.godProgCount);
