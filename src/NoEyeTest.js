/**
 * NoEyeTest: BBGM Prog Script | v4.4.0-draft
 * Port of the v4.3 engine (v43_progression.hpp) to the BBGM worker console.
 *
 * WHAT THIS DOES (differs a lot from v3.2.0):
 *   delta[attr] = G(global age/talent) + commonShock + L(age char + nudge) + noise
 *   with a one-sided soft ceiling on positive gains. God prog is unchanged (v321
 *   flat-bonus semantics). Applies only to age >= 25.
 *
 * KEY PORTING DECISIONS / ASSUMPTIONS (read these):
 *   1. The pool z-scores need league-wide advanced stats. This script reads the
 *      stored advanced stats (per, usgp, astp, trbp, orbp, stlp, blkp, obpm,
 *      dbpm, ortg) that BBGM computes & writes to each stats row at season end.
 *      If those aren't present, those channels degrade gracefully to z=0.
 *   2. The engine's PlayerStats uses PER-GAME counting stats and MPG. BBGM stores
 *      season TOTALS, so every counting stat is divided by gp here, and `min`
 *      becomes mpg. Traded players (multiple rows) are combined.
 *   3. `availability` has no direct BBGM stat -> approximated as gp / numGames.
 *   4. Ratings are integers in BBGM, so fractional deltas are Math.round()ed.
 *
 *   5. ROW MODEL (the important one). BBGM runs its OWN progression when you
 *      advance the season, and there's no way to disable it. This script
 *      REPLACES that for 25+ players:
 *        - INPUT  = the pre-progression baseline row, i.e. the ratings row whose
 *                   season === seasonYr (BBGM hasn't touched it yet).
 *        - OUTPUT = the current live row, ratings.at(-1) (season === current),
 *                   which BBGM already progressed — we OVERWRITE it with
 *                   baseline + our delta.
 *      develop(p, 0) then recomputes ovr/pot from the values we wrote; it does
 *      NOT re-age (see BBGM's own buff/nerf snippet). Run this ONCE, right after
 *      advancing the season into the new year.
 *
 *   6. Pool is built from the WHOLE league; progression is applied only to
 *      watch===1 non-rookies (matches v3.2.0). Flip PROGRESS_ALL to change.
 *   7. The old "watch flagging" preamble is folded in (Pass 0, toggle
 *      FLAG_WATCH): players age>=WATCH_MIN_AGE and tid>=WATCH_MIN_TID are
 *      flagged automatically, so this no longer needs a separate pre-run.
 */

// ============================================================================
//  TUNABLE CONFIG  (mirrors V43Progression::Config defaults)
// ============================================================================
const CFG = {
	// GLOBAL age development
	youngKnee: 27.0,
	youthRate: 0.6,
	oldKnee: 32.0,
	oldRate: 0.9,

	// TALENT-SCALED youth
	youthTalentK: 0.55,
	youthTalentFloor: 0.3,
	youthTalentCap: 1.75,

	// Decline resistance
	declineW: 0.12,
	minResist: 0.5,
	maxResist: 1.2,

	// Production composite
	prodWBpm: 0.7,
	prodWPer: 0.3,
	prodZCap: 3.5,

	// LOCAL per-attribute age character
	agePivot: 27.0,

	// Curated nudge
	nudgeGain: 1.4,
	nudgeCap: 6.0,

	// Noise
	noiseAmp: 1.6,
	noiseRefMpg: 24.0,
	noiseFloor: 8.0,
	noiseMultCap: 1.8,
	commonNoise: 1.4,

	// Soft ceiling
	softCeil: 75.0,
	ceilBand: 7.0,

	// Pool / regression
	regressMinK: 600.0,
	regressAttK: 60.0,
	effAttMin: 20.0,
	minutesFloor: 8.0,

	globalScale: 1.0,

	// God prog (v321 semantics)
	godYoungMax: 30,
	godMinRating: 30,
	godMaxRating: 61,
	godMaxChance: 0.09,
	godMinBonus: 7,
	godMaxBonus: 13,
};

// Progress only watch===1 non-rookies (v3.2.0 behaviour). Set true to progress
// every age>=25 player in the league instead.
const PROGRESS_ALL = false;
const WATCH_VALUE = 1;

// Experimental: show a performance hint in each prog notification.
const SHOW_PERF_HINT = true;

// Auto-flag the players NoEyeTest will progress — folds in the old "watch
// flagging" preamble so it no longer has to be run as a separate script.
const FLAG_WATCH = true;
const WATCH_MIN_AGE = 25; // keep >= 25 to match the engine's own age gate
const WATCH_MIN_TID = -1; // -1 includes free agents; excludes retired/undrafted

// ============================================================================
//  ATTRIBUTE MAPPING
//  Engine ALL_ATTRS order -> BBGM ratings keys. Hgt (idx 14) never progresses.
// ============================================================================
const ATTR_KEYS = [
	'diq', // 0  dIQ
	'dnk', // 1  Dnk
	'drb', // 2  Drb
	'endu', // 3  End
	'fg', // 4  2Pt
	'ft', // 5  FT
	'ins', // 6  Ins
	'jmp', // 7  Jmp
	'oiq', // 8  oIQ
	'pss', // 9  Pss
	'reb', // 10 Reb
	'spd', // 11 Spd
	'stre', // 12 Str
	'tp', // 13 3Pt
	'hgt', // 14 Hgt
];
const IDX = {
	dIQ: 0,
	Dnk: 1,
	Drb: 2,
	End: 3,
	TwoPt: 4,
	FT: 5,
	Ins: 6,
	Jmp: 7,
	oIQ: 8,
	Pss: 9,
	Reb: 10,
	Spd: 11,
	Str: 12,
	ThreePt: 13,
	Hgt: 14,
};

// ageShapeSlope[a]: negative = declines with age, positive = holds/rises.
const AGE_SLOPE = new Array(15).fill(0);
AGE_SLOPE[IDX.Hgt] = 0.0;
AGE_SLOPE[IDX.Spd] = -0.26;
AGE_SLOPE[IDX.Jmp] = -0.26;
AGE_SLOPE[IDX.Dnk] = -0.18;
AGE_SLOPE[IDX.End] = -0.11;
AGE_SLOPE[IDX.Reb] = -0.08;
AGE_SLOPE[IDX.Str] = -0.06;
AGE_SLOPE[IDX.Drb] = -0.05;
AGE_SLOPE[IDX.Ins] = -0.02;
AGE_SLOPE[IDX.TwoPt] = 0.07;
AGE_SLOPE[IDX.Pss] = 0.06;
AGE_SLOPE[IDX.ThreePt] = 0.08;
AGE_SLOPE[IDX.FT] = 0.05;
AGE_SLOPE[IDX.dIQ] = 0.01;
AGE_SLOPE[IDX.oIQ] = 0.01;

// ============================================================================
//  SMALL HELPERS
// ============================================================================
const num = (x) => (Number.isFinite(x) ? x : 0);
const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
const zdiv = (n, d) => (d > 1e-6 ? n / d : 0);
const unit = () => Math.random() * 2 - 1; // uniform (-1, 1)

// BBGM's own OVR function (confirmed correct). Used so before/after and the
// god/ceiling checks all sit on the same ruler develop() uses.
function ovrOf(ratings) {
	try {
		if (bbgm.player && typeof bbgm.player.ovr === 'function') {
			return num(bbgm.player.ovr(ratings));
		}
	} catch (e) {
		/* fall through */
	}
	return num(ratings.ovr);
}

// The pre-progression baseline row (season === seasonYr). This is the input we
// progress FROM. Returns null if the player has no such row.
function baselineRatings(player, seasonYr) {
	return player.ratings.find((r) => r.season === seasonYr) || null;
}

function tovRate(s) {
	const poss = s.fga + 0.44 * s.fta + s.tov; // BBGM USG% basis
	return poss > 1e-6 ? s.tov / poss : 0;
}

// Reliability-weighted running moments.
class Moments {
	constructor() {
		this.wsum = 0;
		this.wx = 0;
		this.wxx = 0;
		this.mean = 0;
		this.sd = 1;
	}
	add(x, w) {
		this.wsum += w;
		this.wx += w * x;
		this.wxx += w * x * x;
	}
	finalize() {
		if (this.wsum <= 1e-9) {
			this.mean = 0;
			this.sd = 1;
			return;
		}
		this.mean = this.wx / this.wsum;
		const varr = this.wxx / this.wsum - this.mean * this.mean;
		this.sd = varr > 1e-9 ? Math.sqrt(varr) : 1.0;
	}
}

// ============================================================================
//  STAT ADAPTER: raw BBGM season rows -> engine-style per-game stat object
// ============================================================================
function adaptStats(rows, numGames) {
	const COUNTING = [
		'min',
		'gp',
		'fga',
		'fta',
		'tov',
		'fgAtRim',
		'fgaAtRim',
		'fgLowPost',
		'fgaLowPost',
		'fgMidRange',
		'fgaMidRange',
		'tp',
		'tpa',
		'ft',
	];
	const RATE_W = [
		'per',
		'usgp',
		'astp',
		'trbp',
		'orbp',
		'stlp',
		'blkp',
		'obpm',
		'dbpm',
		'ortg',
	];

	const tot = {};
	for (const k of COUNTING) tot[k] = 0;
	const wnum = {};
	for (const k of RATE_W) wnum[k] = 0;
	let wsum = 0;

	for (const r of rows) {
		const m = num(r.min);
		for (const k of COUNTING) tot[k] += num(r[k]);
		for (const k of RATE_W) wnum[k] += num(r[k]) * m;
		wsum += m;
	}

	const gp = tot.gp;
	if (gp <= 0 || tot.min <= 0) return null;

	const rate = {};
	for (const k of RATE_W) rate[k] = wsum > 0 ? wnum[k] / wsum : 0;
	const pg = (x) => x / gp; // total -> per game

	return {
		gp,
		min: pg(tot.min), // mpg
		per: rate.per,
		usgp: rate.usgp,
		astp: rate.astp,
		trbp: rate.trbp,
		orbp: rate.orbp,
		stlp: rate.stlp,
		blkp: rate.blkp,
		obpm: rate.obpm,
		dbpm: rate.dbpm,
		ortg: rate.ortg,
		availability: numGames > 0 ? gp / numGames : 0,
		fga: pg(tot.fga),
		tov: pg(tot.tov),
		fta: pg(tot.fta),
		fgaAtRim: pg(tot.fgaAtRim),
		fgAtRim: pg(tot.fgAtRim),
		fgaLowPost: pg(tot.fgaLowPost),
		fgLowPost: pg(tot.fgLowPost),
		fgaMidRange: pg(tot.fgaMidRange),
		fgMidRange: pg(tot.fgMidRange),
		tpa: pg(tot.tpa),
		tp: pg(tot.tp),
		ft: pg(tot.ft),
	};
}

// ============================================================================
//  POOL PREPARATION (reliability-weighted moments)
// ============================================================================
function buildPool(allStats) {
	const pool = {};
	const RATE = {
		usg: (s) => s.usgp,
		ast: (s) => s.astp,
		trb: (s) => s.trbp,
		orb: (s) => s.orbp,
		stl: (s) => s.stlp,
		blk: (s) => s.blkp,
		obpm: (s) => s.obpm,
		dbpm: (s) => s.dbpm,
		ortg: (s) => s.ortg,
		per: (s) => s.per,
		mpg: (s) => s.min,
		avail: (s) => s.availability,
		bpm: (s) => s.obpm + s.dbpm,
		tovr: (s) => tovRate(s),
		rimVol: (s) => s.fgaAtRim,
		postVol: (s) => s.fgaLowPost,
		midVol: (s) => s.fgaMidRange,
		tpVol: (s) => s.tpa,
	};
	const EFF = {
		rimPct: { pct: (s) => zdiv(s.fgAtRim, s.fgaAtRim), att: (s) => s.fgaAtRim },
		postPct: {
			pct: (s) => zdiv(s.fgLowPost, s.fgaLowPost),
			att: (s) => s.fgaLowPost,
		},
		midPct: {
			pct: (s) => zdiv(s.fgMidRange, s.fgaMidRange),
			att: (s) => s.fgaMidRange,
		},
		tpPct: { pct: (s) => zdiv(s.tp, s.tpa), att: (s) => s.tpa },
		ftPct: { pct: (s) => zdiv(s.ft, s.fta), att: (s) => s.fta },
	};

	for (const k in RATE) pool[k] = new Moments();
	for (const k in EFF) pool[k] = new Moments();

	// Rate channels: weight by minutes reliability tmin/(tmin+K).
	for (const s of allStats) {
		if (s.min < CFG.minutesFloor) continue;
		const tmin = s.min * s.gp;
		const w = tmin / (tmin + CFG.regressMinK);
		for (const k in RATE) pool[k].add(RATE[k](s), w);
	}

	// Efficiency channels: weight by attempt reliability att/(att+K).
	for (const k in EFF) {
		const { pct, att } = EFF[k];
		for (const s of allStats) {
			const a = att(s) * s.gp; // total attempts
			if (a < CFG.effAttMin) continue;
			pool[k].add(pct(s), a / (a + CFG.regressAttK));
		}
	}

	for (const k in pool) pool[k].finalize();
	return pool;
}

// ============================================================================
//  Z-SCORES (shrink toward pool mean, then standardize)
// ============================================================================
function shrink(raw, mean, sample, K) {
	return (raw * sample + mean * K) / (sample + K);
}
function zRate(raw, m, totalMin) {
	return (shrink(raw, m.mean, totalMin, CFG.regressMinK) - m.mean) / m.sd;
}
function zEff(raw, m, totalAtt) {
	return (shrink(raw, m.mean, totalAtt, CFG.regressAttK) - m.mean) / m.sd;
}

function zscores(s, pool) {
	const tmin = s.min * s.gp;
	const att = (x) => x * s.gp;
	return {
		usg: zRate(s.usgp, pool.usg, tmin),
		ast: zRate(s.astp, pool.ast, tmin),
		trb: zRate(s.trbp, pool.trb, tmin),
		orb: zRate(s.orbp, pool.orb, tmin),
		stl: zRate(s.stlp, pool.stl, tmin),
		blk: zRate(s.blkp, pool.blk, tmin),
		obpm: zRate(s.obpm, pool.obpm, tmin),
		dbpm: zRate(s.dbpm, pool.dbpm, tmin),
		ortg: zRate(s.ortg, pool.ortg, tmin),
		mpg: zRate(s.min, pool.mpg, tmin),
		avail: zRate(s.availability, pool.avail, tmin),
		tovr: zRate(tovRate(s), pool.tovr, tmin),
		rimVol: zRate(s.fgaAtRim, pool.rimVol, tmin),
		postVol: zRate(s.fgaLowPost, pool.postVol, tmin),
		midVol: zRate(s.fgaMidRange, pool.midVol, tmin),
		tpVol: zRate(s.tpa, pool.tpVol, tmin),
		rimPct: zEff(zdiv(s.fgAtRim, s.fgaAtRim), pool.rimPct, att(s.fgaAtRim)),
		postPct: zEff(
			zdiv(s.fgLowPost, s.fgaLowPost),
			pool.postPct,
			att(s.fgaLowPost),
		),
		midPct: zEff(
			zdiv(s.fgMidRange, s.fgaMidRange),
			pool.midPct,
			att(s.fgaMidRange),
		),
		tpPct: zEff(zdiv(s.tp, s.tpa), pool.tpPct, att(s.tpa)),
		ftPct: zEff(zdiv(s.ft, s.fta), pool.ftPct, att(s.fta)),
	};
}

// Balanced production composite (BPM primary, PER lean), clamped.
function productionP(s, pool) {
	const tmin = s.min * s.gp;
	const P =
		CFG.prodWBpm * zRate(s.obpm + s.dbpm, pool.bpm, tmin) +
		CFG.prodWPer * zRate(s.per, pool.per, tmin);
	return clamp(P, -CFG.prodZCap, CFG.prodZCap);
}

// Global signal: talent-scaled youth − talent-resisted decline.
function globalSignal(age, P) {
	const youthTalent = clamp(
		1 + CFG.youthTalentK * P,
		CFG.youthTalentFloor,
		CFG.youthTalentCap,
	);
	const youthBase =
		CFG.youthRate * Math.max(0, CFG.youngKnee - age) * youthTalent;
	const declineBase = CFG.oldRate * Math.max(0, age - CFG.oldKnee);
	const resist = clamp(1 - CFG.declineW * P, CFG.minResist, CFG.maxResist);
	return youthBase - declineBase * resist;
}

function gainFactor(ovr) {
	return clamp((CFG.softCeil + CFG.ceilBand - ovr) / CFG.ceilBand, 0, 1);
}

function noiseMult(mpg) {
	const m = Math.max(CFG.noiseFloor, mpg);
	return Math.min(Math.sqrt(CFG.noiseRefMpg / m), CFG.noiseMultCap);
}

function statNudge(a, z) {
	switch (a) {
		case IDX.dIQ:
			return 0.4 * z.stl + 0.3 * z.blk + 0.3 * z.dbpm;
		case IDX.Dnk:
			return 0.55 * z.rimPct + 0.3 * z.rimVol;
		case IDX.Drb:
			return 0.4 * z.ast + 0.2 * z.usg - 0.3 * z.tovr;
		case IDX.End:
			return 0.45 * z.mpg + 0.25 * z.avail;
		case IDX.TwoPt:
			return 0.55 * z.midPct + 0.2 * z.midVol;
		case IDX.FT:
			return 0.65 * z.ftPct;
		case IDX.Ins:
			return 0.5 * z.postPct + 0.3 * z.postVol + 0.1 * z.orb;
		case IDX.Jmp:
			return 0.35 * z.blk + 0.25 * z.orb + 0.2 * z.rimVol;
		case IDX.oIQ:
			return 0.5 * z.obpm + 0.3 * z.ast + 0.1 * z.ortg;
		case IDX.Pss:
			return 0.65 * z.ast + 0.15 * z.obpm - 0.2 * z.tovr;
		case IDX.Reb:
			return 0.55 * z.trb + 0.25 * z.orb;
		case IDX.Spd:
			return 0.25 * z.stl + 0.15 * z.ast; // weak proxy
		case IDX.Str:
			return 0.35 * z.postVol + 0.3 * z.orb + 0.2 * z.dbpm;
		case IDX.ThreePt:
			return 0.55 * z.tpPct + 0.25 * z.tpVol;
		default:
			return 0;
	}
}

function godChance(ovr) {
	let scale;
	if (ovr < CFG.godMinRating) scale = 1.0;
	else if (ovr > CFG.godMaxRating) scale = 0.01;
	else
		scale =
			1.0 - (ovr - CFG.godMinRating) / (CFG.godMaxRating - CFG.godMinRating);
	return scale * CFG.godMaxChance;
}

// ============================================================================
//  APPLY PROGRESSION TO A SINGLE PLAYER
//  Reads from the seasonYr baseline row, writes baseline+delta onto the live
//  row (ratings.at(-1)), replacing BBGM's own progression.
// ============================================================================
function progressPlayer(player, s, pool, season) {
	const seasonYr = season - 1;
	const src = baselineRatings(player, seasonYr); // input: pre-progression row
	const dst = player.ratings.at(-1); // output: live row BBGM already progressed
	if (!src) return { changed: false, god: false }; // no baseline -> skip safely

	const age = season - player.born.year;
	const ovr = ovrOf(src); // god/ceiling keyed off the baseline OVR

	// snapshot the PRE-progression baseline attrs (BBGM hasn't touched these)
	const attrs = ATTR_KEYS.map((k) => num(src[k]));

	if (age < 25 || s.per <= 0) return { changed: false, god: false };

	// Overwrite the live row with baseline + our delta (replaces BBGM's prog).
	const writeBack = () => {
		for (let a = 0; a < 15; a++) {
			if (a === IDX.Hgt) continue;
			dst[ATTR_KEYS[a]] = bbgm.player.limitRating(Math.round(attrs[a]));
		}
	};

	// ---- GOD PROG: rare flat replacement, bypasses everything below ----
	if (age < CFG.godYoungMax) {
		const chance = godChance(ovr);
		if (Math.random() < chance) {
			const bonus = bbgm.random.randInt(CFG.godMinBonus, CFG.godMaxBonus);
			for (let a = 0; a < 15; a++) {
				if (a === IDX.Hgt) continue;
				attrs[a] = clamp(attrs[a] + bonus, 0, 100);
			}
			writeBack();
			return { changed: true, god: true, bonus };
		}
	}

	// ---- NORMAL PROGRESSION ----
	const P = productionP(s, pool);
	const nmult = noiseMult(s.min);
	const commonShock = unit() * CFG.commonNoise * nmult; // correlated across attrs
	const Gage = globalSignal(age, P) * CFG.globalScale;
	const z = zscores(s, pool);
	const gf = gainFactor(ovr);
	const namp = CFG.noiseAmp * nmult;

	// --- debug accumulators (delete when done tuning) ---
	let dbgAgeShape = 0;
	let dbgNudge = 0;
	let dbgNoise = 0;
	let dbgDelta = 0;

	for (let a = 0; a < 15; a++) {
		if (a === IDX.Hgt) continue;
		const ageShape = AGE_SLOPE[a] * (age - CFG.agePivot);
		const nudge = clamp(
			CFG.nudgeGain * statNudge(a, z),
			-CFG.nudgeCap,
			CFG.nudgeCap,
		);
		const L = ageShape + nudge;
		const noise = unit() * namp;
		// IQ attrs (oIQ/dIQ) are age-independent: they skip the global age signal.
		const base = a === IDX.oIQ || a === IDX.dIQ ? 0 : Gage;
		let delta = base + commonShock + L + noise;
		if (delta > 0) delta *= gf; // one-sided soft ceiling
		attrs[a] = clamp(attrs[a] + delta, 0, 100);

		dbgAgeShape += ageShape;
		dbgNudge += nudge;
		dbgNoise += noise;
		dbgDelta += delta;
	}

	writeBack();
	return {
		changed: true,
		god: false,
		P,
		Gage,
		dbg: {
			gf,
			commonShock,
			ageShape: dbgAgeShape,
			nudge: dbgNudge,
			noise: dbgNoise,
			total: dbgDelta,
		},
	};
}

// ============================================================================
//  NOTIFICATIONS
// ============================================================================
function prodHint(P) {
	let tier;
	if (P >= 1.5) tier = 'Elite';
	else if (P >= 0.5) tier = 'Strong';
	else if (P > -0.5) tier = 'Average';
	else if (P > -1.5) tier = 'Below avg';
	else tier = 'Poor';
	const sign = P >= 0 ? '+' : '';
	return `${tier} (${sign}${P.toFixed(1)}z)`;
}

async function sendProgNotification(
	player,
	s,
	before,
	after,
	res,
	seasonYr,
	season,
) {
	const { pid, firstName, lastName, tid } = player;
	const title = res.god ? 'God Progged!<br/>Prog Info:' : 'Prog Info:';
	const age = season - player.born.year;
	const diff = after - before;
	const sign = diff >= 0 ? '+' : '';

	let hint = '';
	if (SHOW_PERF_HINT) {
		hint = res.god
			? '<br/><b>Trend:</b> ↑↑↑ God Prog'
			: `<br/><b>Season:</b> ${prodHint(res.P)}`;
	}

	// --- temporary tuning breakdown (delete this block + the dbg accumulators
	//     in progressPlayer when finished) ---
	let dbg = '';
	if (res.dbg) {
		const d = res.dbg;
		const f = (x) => (x >= 0 ? '+' : '') + x.toFixed(1);
		dbg =
			`<br/><b>Gage:</b> ${f(res.Gage)}  <b>gf:</b> ${d.gf.toFixed(2)}` +
			`<br/><b>Σnudge:</b> ${f(d.nudge)}  <b>ΣageShape:</b> ${f(d.ageShape)}` +
			`<br/><b>shock/attr:</b> ${f(d.commonShock)}  <b>Σnoise:</b> ${f(d.noise)}` +
			`<br/><b>Σdelta:</b> ${f(d.total)}`;
	}
	// --- end tuning block ---

	await bbgm.logEvent({
		type: 'Progs',
		text: `<a href="${bbgm.helpers.leagueUrl(['player', pid])}">${firstName} ${lastName} ${title}</a><br/><b>OVR:</b> ${before} → ${after} (${sign}${diff})${hint}${dbg}<br/><b>PER:</b> ${s.per.toFixed(2)}<br/><b>Age:</b> ${age}<br/><b>${seasonYr}</b>`,
		showNotification: true,
		pids: [pid],
		tids: [tid],
		persistent: false,
		score: 20,
	});
}

async function logGodProgs(godProgCount, progCount) {
	await bbgm.logEvent({
		type: 'God Progs',
		text: `Progressed ${progCount} players. God Prog Count This Run: ${godProgCount}`,
		showNotification: true,
		persistent: false,
		score: 20,
		pids: [0],
	});
}

// ============================================================================
//  MAIN
// ============================================================================
async function main() {
	const season = bbgm.g.get('season');
	const seasonYr = season - 1;
	const numGames = bbgm.g.get('numGames');

	const players = await bbgm.idb.cache.players.getAll();

	// --- Pass 0: auto-flag who NoEyeTest will progress (folded-in preamble) ---
	if (FLAG_WATCH) {
		for (const p of players) {
			const age = season - p.born.year;
			p.watch =
				age >= WATCH_MIN_AGE && p.tid >= WATCH_MIN_TID ? WATCH_VALUE : 0;
		}
	}

	// --- Pass 1: adapt last season's stats for every player, build the pool ---
	const statsByPid = new Map();
	const allStats = [];
	for (const p of players) {
		const rows = (p.stats || []).filter(
			(st) => st.season === seasonYr && !st.playoffs,
		);
		if (rows.length === 0) continue;
		const s = adaptStats(rows, numGames);
		if (!s) continue;
		statsByPid.set(p.pid, s);
		allStats.push(s);
	}
	const pool = buildPool(allStats);

	// --- Pass 2: progress the selected players against the pool ---
	let godProgCount = 0;
	let progCount = 0;
	for (const p of players) {
		if (!PROGRESS_ALL && p.watch !== WATCH_VALUE) continue;
		if (p.draft.year === seasonYr) continue; // skip rookies drafted this season
		const s = statsByPid.get(p.pid);
		if (!s) continue; // no stats to progress on

		// "before" = baseline OVR (pre-progression row), same ruler as "after".
		const src = baselineRatings(p, seasonYr);
		if (!src) continue; // no baseline row -> can't progress this player
		const before = ovrOf(src);

		const res = progressPlayer(p, s, pool, season);
		if (!res.changed) continue;

		progCount += 1;
		if (res.god) godProgCount += 1;

		await bbgm.player.develop(p, 0); // recompute ovr/pot from the attrs we wrote
		await bbgm.player.updateValues(p);
		await bbgm.idb.cache.players.put(p);

		const after = ovrOf(p.ratings.at(-1));
		await sendProgNotification(p, s, before, after, res, seasonYr, season);
	}

	await logGodProgs(godProgCount, progCount);
}

await main();
