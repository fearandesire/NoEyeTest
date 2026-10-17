// Regenerate the Candidate (src/NoEyeTest.js) parity goldens after an
// intentional tuning change. Published cases are left untouched.
// Usage: node tests/helpers/regenerate-candidate-goldens.cjs
const { createHash } = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { runScript, keys } = require('./run-script.cjs');
const { inputFor } = require('./parity-input.cjs');

const root = path.resolve(__dirname, '../..');
const file = path.join(root, 'tests/fixtures/net_parity_cases.json');
const fixtures = JSON.parse(fs.readFileSync(file, 'utf8'));

(async () => {
	let changed = 0;
	for (const c of fixtures.cases) {
		if (c.version !== 'v43') continue;
		const result = await runScript(inputFor(c), {
			draws: c.draws,
			fallback: c.drawFallback,
			observe: false,
		});
		const ratings = result.players[0].ratings.at(-1);
		const god = result.events.some((e) => e.text.includes('God Progged!'));
		const expected = {
			attrs: keys.map((key) => ratings[key]),
			ovr: ratings.ovr,
			godBonus: god ? Math.floor((c.draws[1] ?? c.drawFallback) * 7) + 7 : null,
			drawCount: result.drawCount,
		};
		if (JSON.stringify(expected) !== JSON.stringify(c.expected)) changed++;
		c.expected = expected;
	}
	fixtures.references.candidateSha256 = createHash('sha256')
		.update(fs.readFileSync(path.join(root, 'src/NoEyeTest.js')))
		.digest('hex');
	fs.writeFileSync(file, `${JSON.stringify(fixtures, null, 2)}\n`);
	console.log(`Updated ${changed} Candidate cases`);
})().catch((error) => {
	console.error(error);
	process.exitCode = 1;
});
