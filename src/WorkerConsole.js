/**
 * This code is to be executed in the `Worker Console` prior to running `NoEyeTest` AND prior to simming to `progs`/`preseason`.
 * If you forget to run this first and have already simmed, you are able to change the `age` on line 14 to `26`, and then run NoEyeTest again.
 * See README.md for more information
 */
const players = await bbgm.idb.cache.players.getAll();
const seasonObj = await bbgm.idb.cache.gameAttributes.get('season');
const season = seasonObj.value;
for (const p of players) {
	const age = Number(season) - Number(p.born.year);
	// Anyone above this age will be effected by `NoEyeTest`
	// Free agents WILL be affected
	if (age >= 25 && p.tid >= -1) {
		p.watch = 1;
	} else {
		p.watch = 0;
	}
}
