const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const { runScript, player, keys, ovr } = require('./helpers/run-script.cjs');
const fixtures = require('./fixtures/net_parity_cases.json');

function rawStats(stats) {
	const row = { ...stats, season: 2019, playoffs: false };
	for (const key of [
		'min',
		'fga',
		'fta',
		'tpa',
		'tp',
		'ft',
		'fgaAtRim',
		'fgAtRim',
		'fgaLowPost',
		'fgLowPost',
		'fgaMidRange',
		'fgMidRange',
		'orb',
		'tov',
	])
		row[key] *= stats.gp;
	row.minAvailable = stats.availability > 0 ? row.min / stats.availability : 0;
	return row;
}
function inputFor(c) {
	const ratings = Object.fromEntries(
		keys.map((key, index) => [key, c.attrs[index]]),
	);
	ratings.ovr = ovr(ratings);
	const target = player(1, {
		born: { year: 2020 - c.age },
		stats: [rawStats(c.stats)],
		ratings: [
			{ ...ratings, season: 2019 },
			{ ...ratings, season: 2020 },
		],
	});
	if (c.version === 'v321') return [target];
	const remaining = structuredClone(c.pool);
	if (c.age >= 25 && c.stats.per !== 0) {
		const index = remaining.findIndex(
			(stats) => JSON.stringify(stats) === JSON.stringify(c.stats),
		);
		assert.ok(
			index >= 0,
			'a progressing target must occur in its own preparation pool',
		);
		remaining.splice(index, 1);
	}
	return [
		target,
		...remaining.map((stats, index) =>
			player(index + 2, { watch: 0, stats: [rawStats(stats)] }),
		),
	];
}

test('shared goldens pin both script source hashes and BBGM revision', () => {
	for (const [file, hash] of [
		['src/NoEyeTest.js', fixtures.references.candidateSha256],
		[
			'tests/fixtures/published-972f9d3.js',
			fixtures.references.publishedSha256,
		],
	]) {
		assert.equal(
			createHash('sha256')
				.update(fs.readFileSync(path.join(__dirname, '..', file)))
				.digest('hex'),
			hash,
		);
	}
	assert.equal(
		fixtures.references.bbgmCommit,
		require('./fixtures/bbgm/sources.json').revision,
	);
});

for (const c of fixtures.cases) {
	test(`full-script parity: ${c.name}`, async () => {
		const input = inputFor(c);
		const result = await runScript(input, {
			draws: c.draws,
			fallback: c.drawFallback,
			file:
				c.version === 'v43'
					? 'src/NoEyeTest.js'
					: 'tests/fixtures/published-972f9d3.js',
			observe: c.version === 'v43',
		});
		const ratings = result.players[0].ratings.at(-1);
		assert.deepEqual(
			keys.map((key) => ratings[key]),
			c.expected.attrs,
		);
		assert.equal(ratings.ovr, c.expected.ovr);
		assert.equal(result.drawCount, c.expected.drawCount);
		assert.equal(
			result.events.some((event) => event.text.includes('God Progged!')),
			c.expected.godBonus !== null,
		);
		assert.deepEqual(result.players[0].ratings[0], input[0].ratings[0]);
		for (let index = 1; index < input.length; index++)
			assert.deepEqual(result.players[index], input[index]);
	});
}

test('Published averages nonzero prior-season trade PER and ignores playoff/stale rows', async () => {
	const rows = [
		{ season: 2018, per: 99 },
		{ season: 2019, per: 20 },
		{ season: 2019, per: 0 },
		{ season: 2019, per: 10 },
		{ season: 2019, per: 90, playoffs: true },
	];
	const options = {
		file: 'tests/fixtures/published-972f9d3.js',
		observe: false,
	};
	const traded = await runScript([player(1, { stats: rows })], options);
	const average = await runScript(
		[player(1, { stats: [{ season: 2019, per: 15 }] })],
		options,
	);
	assert.deepEqual(traded.writes[0].ratings, average.writes[0].ratings);
	assert.equal(traded.drawCount, average.drawCount);
	const stale = player(2, { stats: [{ season: 2018, per: 15 }] });
	assert.deepEqual((await runScript([stale], options)).players, [stale]);
});
