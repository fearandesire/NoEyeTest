const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const { runScript, player, keys } = require('./helpers/run-script.cjs');
const { inputFor } = require('./helpers/parity-input.cjs');
const fixtures = require('./fixtures/net_parity_cases.json');

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
	// Published notifications write once before progression. Compare the final
	// player, otherwise the untouched baseline passes for any expected PER.
	assert.deepEqual(traded.players[0].ratings, average.players[0].ratings);
	assert.equal(traded.drawCount, average.drawCount);
	const lastStint = await runScript(
		[player(1, { stats: [{ season: 2019, per: 10 }] })],
		options,
	);
	assert.notDeepEqual(traded.players[0].ratings, lastStint.players[0].ratings);
	const stale = player(2, { stats: [{ season: 2018, per: 15 }] });
	assert.deepEqual((await runScript([stale], options)).players, [stale]);
});
