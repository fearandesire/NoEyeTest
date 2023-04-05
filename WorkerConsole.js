// Providing the code snippet to 'flag' players for `NoEyeTest` to be tested without using an external script.
// Run this in the 'Worker Console' in the BBGM Website.
var players = await bbgm.idb.cache.players.getAll();
const seasonObj = await bbgm.idb.cache.gameAttributes.get(`season`);
const season = seasonObj.value;
for (const p of players) {
  const age = Number(season) - Number(p.born.year);
  // Anyone above this age will be effected by `NoEyeTest`
  if (age > 25) {
    p.note = "balanced";
  } else {
    p.note = "classic";
  }
}
