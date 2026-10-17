const { player, keys, ovr } = require('./run-script.cjs');

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
	// The Candidate pools every player with prior-season stats, so the target
	// always supplies its own row. Pool players are under 25 so NET's own
	// watch flagging leaves them untouched.
	const remaining = structuredClone(c.pool);
	const index = remaining.findIndex(
		(stats) => JSON.stringify(stats) === JSON.stringify(c.stats),
	);
	if (index >= 0) remaining.splice(index, 1);
	return [
		target,
		...remaining.map((stats, index) =>
			player(index + 2, {
				watch: 0,
				born: { year: 2000 },
				stats: [rawStats(stats)],
			}),
		),
	];
}
module.exports = { inputFor };
