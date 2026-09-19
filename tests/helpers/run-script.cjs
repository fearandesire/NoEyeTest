const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '../..');
const helperRoot = path.join(root, 'tests/fixtures/bbgm');
const sources = require('../fixtures/bbgm/sources.json');
for (const entry of sources.files) {
	assert.equal(
		createHash('sha256')
			.update(fs.readFileSync(path.join(helperRoot, entry.file)))
			.digest('hex'),
		entry.sha256,
	);
}
function helper(file, name) {
	const source = fs
		.readFileSync(path.join(helperRoot, file), 'utf8')
		.replace(/^import type .*;\n/m, '')
		.replace(/: (number|PlayerRatings)/g, '')
		.replace(`export default ${name};`, name);
	return vm.runInNewContext(source);
}
const limitRating = helper('limitRating.ts', 'limitRating');
const ovr = helper('ovr.basketball.ts', 'ovr');
function randomHelper(math) {
	const source = fs.readFileSync(path.join(helperRoot, 'random.ts'), 'utf8');
	const functions = ['uniformSeed', 'randInt']
		.map((name) => {
			const match = source.match(
				new RegExp(`export const ${name} = [\\s\\S]*?\\n};`),
			);
			assert.ok(match, `missing pinned ${name} helper`);
			return match[0].replace('export ', '').replace(/\??: number/g, '');
		})
		.join('\n');
	return vm.runInNewContext(`${functions}\nrandInt;`, { Math: math });
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
	'hgt',
];
function player(pid, overrides = {}) {
	const ratings = Object.fromEntries(keys.map((key) => [key, 50]));
	ratings.ovr = ovr(ratings);
	return {
		pid,
		firstName: 'Fixture',
		lastName: String(pid),
		tid: 0,
		born: { year: 1990 },
		draft: { year: 2010 },
		watch: 1,
		ratings: [
			{ ...ratings, season: 2019 },
			{ ...ratings, spd: 99, season: 2020 },
		],
		stats: [{ season: 2019, playoffs: false, per: 15, gp: 82, min: 1968 }],
		...overrides,
	};
}
async function runScript(
	input,
	{
		season = 2020,
		draws = [],
		fallback = 0.5,
		file = 'src/NoEyeTest.js',
		observe = true,
	} = {},
) {
	const players = structuredClone(input);
	const writes = [];
	const events = [];
	const observations = {};
	let drawCount = 0;
	const math = Object.create(Math);
	math.random = () => {
		const value = draws[drawCount++] ?? fallback;
		assert.ok(value >= 0 && value < 1, 'random draw outside [0, 1)');
		return value;
	};
	const bbgm = {
		g: { get: (key) => ({ season, phase: 0 })[key] },
		random: { randInt: randomHelper(math) },
		idb: {
			cache: {
				players: {
					getAll: async () => players,
					put: async (p) => {
						writes.push(structuredClone(p));
					},
				},
				gameAttributes: { get: async () => ({ value: season }) },
			},
		},
		helpers: { leagueUrl: (parts) => parts.join('/') },
		logEvent: async (event) => {
			events.push(structuredClone(event));
		},
		player: {
			limitRating,
			ovr,
			addRatingsRow: (p) => {
				p.ratings.push({ ...structuredClone(p.ratings.at(-1)), season });
			},
			develop: async (p, years) => {
				assert.equal(years, 0);
				p.ratings.at(-1).ovr = ovr(p.ratings.at(-1));
			},
			updateValues: async () => {},
		},
	};
	// Observe preparation at its call boundary. The complete browser source runs unchanged.
	const observer = observe
		? `
		const originalStatsFor = statsFor;
		const owners = new WeakMap();
		statsFor = (p, year) => { const s = originalStatsFor(p, year); if (s) owners.set(s, p.pid); return s; };
		const originalPreparePool = preparePool;
		preparePool = (stats) => { const pool = originalPreparePool(stats); capture(stats.map(s => owners.get(s)), pool); return pool; };
	`
		: '';
	const source = fs.readFileSync(path.join(root, file), 'utf8');
	await vm.runInNewContext(
		`(async () => { ${observer}\n${source}\n})()`,
		{
			bbgm,
			Math: math,
			console,
			capture: (ids, pool) => {
				observations.ids = structuredClone(ids);
				observations.pool = structuredClone(pool);
			},
		},
		{ filename: file, timeout: 1000 },
	);
	return { players, writes, events, ...observations, drawCount };
}
module.exports = { runScript, player, keys, limitRating, ovr };
