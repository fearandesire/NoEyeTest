const assert = require('node:assert/strict');
const { test } = require('node:test');
const {
	runScript,
	player,
	keys,
	limitRating,
	ovr,
} = require('./helpers/run-script.cjs');

test('pinned BBGM helpers floor fractional ratings and derive OVR', () => {
	assert.deepEqual([-0.2, 0.9, 49.9, 100.8].map(limitRating), [0, 0, 49, 100]);
	assert.equal(ovr(player(1).ratings[0]), 55);
});

test('preparation includes negative PER but excludes inactive, malformed and young players', async () => {
	const input = [
		player(1),
		player(2, {
			tid: -1,
			watch: 0,
			stats: [{ season: 2019, per: -5, gp: 82, min: 1968 }],
		}),
		player(3, { tid: -2 }),
		player(4, { ratings: [] }),
		player(5, { born: { year: 1996 } }),
		player(6, { born: {} }),
		player(7, { born: null }),
		player(8, { tid: undefined }),
	];
	const result = await runScript(input);
	assert.deepEqual(result.ids, [1, 2]);
	assert.equal(result.pool.per.mean, 5);
	assert.equal(result.pool.per.sd, 10);
	assert.ok(Math.abs(result.pool.per.wsum - (2 * 1968) / 2568) < 1e-12);
	assert.deepEqual(
		result.writes.map((p) => p.pid),
		[1],
	);
	for (let i = 1; i < input.length; i++)
		assert.deepEqual(result.players[i], input[i]);
});

test('all skip predicates preserve the complete original ratings history', async () => {
	const input = [
		player(1, { born: { year: 1996 } }),
		player(2, { watch: 0 }),
		player(3, { tid: -2 }),
		player(4, { stats: [{ season: 2019, per: 0 }] }),
		player(5, { stats: [{ season: 2019, per: -5 }] }),
		player(6, { draft: { year: 2019 } }),
		player(7, { ratings: [player(7).ratings[0]] }),
	];
	const result = await runScript(input);
	assert.deepEqual(result.players, input);
	assert.deepEqual(result.writes, []);
});

test('uses last prior-season regular stint and rejects stale or playoff-only histories', async () => {
	const input = [
		player(1, {
			stats: [
				{ season: 2018, per: 99 },
				{ season: 2019, per: 20, gp: 82, min: 1968 },
				{ season: 2019, per: 10, gp: 82, min: 1968 },
				{ season: 2019, per: 90, playoffs: true },
				{ season: 2019, per: 80, playoffs: true },
			],
		}),
		player(2, { stats: [{ season: 2018, per: 60 }] }),
		player(3, {
			stats: [
				{ season: 2019, per: 60, playoffs: true },
				{ season: 2019, per: 70, playoffs: true },
			],
		}),
		player(4, {
			stats: [
				{ season: 2019, per: 20 },
				{ season: 2019, per: 0 },
			],
		}),
	];
	const result = await runScript(input);
	assert.deepEqual(result.ids, [1]);
	assert.equal(result.pool.per.mean, 10);
	assert.deepEqual(
		result.writes.map((p) => p.pid),
		[1],
	);
	for (let i = 1; i < input.length; i++)
		assert.deepEqual(result.players[i], input[i]);
});

test('full script restores prior ratings and floors the age30 zero-noise result', async () => {
	const input = [player(1)];
	const result = await runScript(input);
	const ratings = result.writes[0].ratings;
	assert.equal(ratings.length, 2);
	assert.deepEqual(ratings[0], input[0].ratings[0]);
	assert.equal(ratings[1].season, 2020);
	assert.deepEqual(
		keys.map((key) => ratings[1][key]),
		[50, 49, 49, 49, 50, 50, 49, 49, 50, 50, 49, 49, 49, 50, 50],
	);
	assert.equal(ratings[1].ovr, 54);
	assert.equal(result.drawCount, 15);
});

test('minute and attempt reliability boundaries affect different pool moments', async () => {
	const input = [
		player(1, {
			watch: 0,
			stats: [{ season: 2019, per: 20, gp: 1, min: 8, tpa: 20, tp: 10 }],
		}),
		player(2, {
			watch: 0,
			stats: [{ season: 2019, per: 99, gp: 1, min: 7.99, tpa: 19, tp: 19 }],
		}),
	];
	const result = await runScript(input);
	assert.equal(result.pool.per.mean, 20);
	assert.equal(result.pool.tpPct.mean, 0.5);
	assert.equal(result.pool.tpPct.wsum, 0.25);
	assert.ok(Math.abs(result.pool.per.wsum - 8 / 608) < 1e-12);
});

test('WorkerConsole flags age25 before rollover and normal NET targets enter at26', async () => {
	const before = [
		player(1, { watch: 0, born: { year: 1994 } }),
		player(2, { watch: 0, born: { year: 1995 } }),
		player(3, { watch: 0, tid: -2, born: { year: 1994 } }),
	];
	const flags = await runScript(before, {
		season: 2019,
		file: 'src/WorkerConsole.js',
		observe: false,
	});
	assert.deepEqual(
		flags.players.map((p) => p.watch),
		[1, 0, 0],
	);
	const after = await runScript(flags.players);
	assert.deepEqual(
		after.writes.map((p) => p.pid),
		[1],
	);
	assert.deepEqual(after.players[1], flags.players[1]);
});

test('negative PER contributes to moments without replacing the preseason ratings row', async () => {
	const positive = player(1);
	const negative = player(2, {
		stats: [{ season: 2019, per: -5, gp: 82, min: 1968 }],
	});
	const result = await runScript([positive, negative]);
	assert.deepEqual(result.ids, [1, 2]);
	assert.equal(result.pool.per.mean, 5);
	assert.deepEqual(result.players[1], negative);
	assert.deepEqual(
		result.writes.map((p) => p.pid),
		[1],
	);
	assert.deepEqual(
		keys.map((key) => result.writes[0].ratings.at(-1)[key]),
		[50, 49, 49, 49, 50, 50, 49, 49, 50, 50, 49, 49, 49, 50, 50],
	);
});

test('malformed identities and nonfinite PER never enter preparation or mutate ratings', async () => {
	const input = [
		player(1, { born: { year: 0 } }),
		player(2, { born: { year: '1990' } }),
		player(3, { born: { year: 1990.5 } }),
		player(4, { tid: '-1' }),
		player(5, { tid: null }),
		player(6, { ratings: null }),
		player(7, { stats: [{ season: 2019, per: Number.POSITIVE_INFINITY }] }),
		player(8, { stats: [{ season: 2019, per: Number.NaN }] }),
	];
	const result = await runScript(input);
	assert.deepEqual(result.ids, []);
	assert.deepEqual(result.players, input);
	assert.deepEqual(result.writes, []);
});
