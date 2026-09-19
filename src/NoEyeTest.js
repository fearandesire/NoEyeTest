/**
 * NoEyeTest: BBGM Prog Script | v4.3.0 (opt-in release)
 *
 * Port of progbox v4.3 (engine source v43_progression.hpp; compact CLI
 * aliases like v43/v321 exist in progbox only). Two-pass: pool moments from
 * active/free-agent player age ≥ 25 with valid ratings and PER ≠ 0, then
 * progress watched players age 25+. Under-25 watched players keep BBGM progs.
 *
 * Production composite: 70% BPM + 30% PER. Soft ceiling (not hard OVR 80).
 * Defenders get credit via STL%/BLK%/DBPM. RNG is Math.random() (no seed;
 * BBGM has none).
 *
 * Progbox Published comparison remains 3.2.x ↔ v3.2.1. See README.md to opt in.
 */

// Attr index order = C++ ALL_ATTRS. BBGM keys: 2Pt→fg, 3Pt→tp, End→endu, Str→stre.
const ATTR_KEYS = [
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

const ATTR = {
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

// v4.3: Config — verbatim from V43Progression::Config (progbox compact alias)
const CONFIG = {
	youngKnee: 28.0,
	youthRate: 0.6,
	oldKnee: 32.0,
	oldRate: 0.6,
	youthTalentK: 0.55,
	youthTalentFloor: 0.3,
	youthTalentCap: 1.75,
	declineW: 0.12,
	minResist: 0.5,
	maxResist: 1.6,
	prodWBpm: 0.7,
	prodWPer: 0.3,
	prodZCap: 3.5,
	agePivot: 27.0,
	// v4.3: ageShapeSlope[15] — index matches ATTR / ALL_ATTRS
	ageShapeSlope: (() => {
		const s = new Array(15).fill(0);
		s[ATTR.Hgt] = 0.0;
		s[ATTR.Spd] = -0.26;
		s[ATTR.Jmp] = -0.26;
		s[ATTR.Dnk] = -0.18;
		s[ATTR.End] = -0.11;
		s[ATTR.Reb] = -0.08;
		s[ATTR.Str] = -0.06;
		s[ATTR.Drb] = -0.05;
		s[ATTR.Ins] = -0.02;
		s[ATTR.TwoPt] = 0.07;
		s[ATTR.Pss] = 0.06;
		s[ATTR.ThreePt] = 0.08;
		s[ATTR.FT] = 0.05;
		s[ATTR.dIQ] = 0.01;
		s[ATTR.oIQ] = 0.01;
		return s;
	})(),
	nudgeGain: 1.7,
	nudgeCap: 6.0,
	noiseAmp: 1.6,
	noiseRefMpg: 24.0,
	noiseFloor: 8.0,
	noiseMultCap: 1.8,
	commonNoise: 1.4,
	softCeil: 78.0,
	ceilBand: 4.0,
	regressMinK: 600.0,
	regressAttK: 60.0,
	effAttMin: 20.0,
	minutesFloor: 8.0,
	globalScale: 1.0,
	// v4.3: god* = v3.2.1 values (progbox compact alias v321)
	godYoungMax: 30,
	godMinRating: 30,
	godMaxRating: 61,
	godMaxChance: 0.09,
	godMinBonus: 7,
	godMaxBonus: 13,
};

/**
 * Creates a notification into the game's log.
 * Fields: player, per, ovr, age, delta (attr→Δ map), godProg.
 */
async function sendProgNotification(data) {
	const { player, per, godProg, ovr, age, delta } = data || {};
	const SZN = bbgm.g.get('season');
	const seasonYr = SZN - 1;
	if (!player) {
		return;
	}
	const { pid, firstName, lastName, tid } = player;
	if (!pid) {
		return;
	}
	const notiTitle = godProg ? 'God Progged!<br/>Prog Info:' : 'Prog Info:';
	const perFull = per != null ? Number(per).toFixed(2) : 'N/A';
	const ageFull = age != null ? String(age) : 'N/A';
	let deltaText = 'N/A';
	if (delta && typeof delta === 'object') {
		const parts = Object.entries(delta)
			.filter(([, v]) => Math.abs(v) >= 0.05)
			.map(([k, v]) => `${k}:${v >= 0 ? '+' : ''}${v.toFixed(1)}`)
			.slice(0, 12);
		deltaText = parts.length ? parts.join(' ') : '(flat)';
	}
	await bbgm.logEvent({
		type: 'Progs',
		text: `<a href="${bbgm.helpers.leagueUrl([
			'player',
			pid,
		])}">\n${firstName} ${lastName} ${notiTitle}</a><br/><b>Δ:</b> ${deltaText}<br/><b>
        PER:
        </b> ${perFull}<br/><b>
        Age:
    </b> ${ageFull}<br/>OVR: ${ovr}<br/><b>${seasonYr}</b>`,
		showNotification: true,
		pids: [pid],
		tids: [tid],
		persistent: false,
		score: 20,
	});
}

function clamp(x, lo, hi) {
	return Math.max(lo, Math.min(hi, x));
}

function zdiv(n, d) {
	return d > 1e-6 ? n / d : 0.0;
}

function tovRate(s) {
	const poss = s.fga + 0.44 * s.fta + s.tov;
	return poss > 1e-6 ? s.tov / poss : 0.0;
}

function unitNoise() {
	return Math.random() * 2 - 1;
}

function randIntInclusive(min, max) {
	return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Last non-playoff season row for seasonYr → PlayerStats shape.
 * Stale rows and playoff-only histories never supply a regular season.
 */
function statsFor(p, seasonYr) {
	const rows = p.stats || [];
	let row = null;
	for (let i = rows.length - 1; i >= 0; i--) {
		const st = rows[i];
		if (st.season === seasonYr && !st.playoffs) {
			row = st;
			break;
		}
	}
	if (!row) {
		return null;
	}
	const per = Number(row.per) || 0;
	if (!Number.isFinite(per) || per === 0) {
		return null;
	}
	const gp = Number(row.gp) || 0;
	const rd = (k) => Number(row[k]) || 0;
	const pg = (k) => (gp > 0 ? rd(k) / gp : 0);
	const minTotal = rd('min');
	const minAvail = rd('minAvailable');
	return {
		per,
		obpm: rd('obpm'),
		dbpm: rd('dbpm'),
		stlp: rd('stlp'),
		blkp: rd('blkp'),
		usgp: rd('usgp'),
		astp: rd('astp'),
		trbp: rd('trbp'),
		orbp: rd('orbp'),
		ortg: rd('ortg'),
		fga: pg('fga'),
		fta: pg('fta'),
		tpa: pg('tpa'),
		tp: pg('tp'),
		ft: pg('ft'),
		fgaAtRim: pg('fgaAtRim'),
		fgAtRim: pg('fgAtRim'),
		fgaLowPost: pg('fgaLowPost'),
		fgLowPost: pg('fgLowPost'),
		fgaMidRange: pg('fgaMidRange'),
		fgMidRange: pg('fgMidRange'),
		orb: pg('orb'),
		tov: pg('tov'),
		min: gp > 0 ? minTotal / gp : 0,
		availability: minAvail > 0 ? Math.min(1, minTotal / minAvail) : 0,
		gp,
	};
}

// v4.3: Moments — reliability-weighted running mean/sd
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
		const v = this.wxx / this.wsum - this.mean * this.mean;
		this.sd = v > 1e-9 ? Math.sqrt(v) : 1.0;
	}
}

function emptyPool() {
	return {
		usg: new Moments(),
		ast: new Moments(),
		trb: new Moments(),
		orb: new Moments(),
		stl: new Moments(),
		blk: new Moments(),
		obpm: new Moments(),
		dbpm: new Moments(),
		ortg: new Moments(),
		per: new Moments(),
		mpg: new Moments(),
		avail: new Moments(),
		bpm: new Moments(),
		tovr: new Moments(),
		rimVol: new Moments(),
		postVol: new Moments(),
		midVol: new Moments(),
		tpVol: new Moments(),
		rimPct: new Moments(),
		postPct: new Moments(),
		midPct: new Moments(),
		tpPct: new Moments(),
		ftPct: new Moments(),
	};
}

/**
 * Pass 1: reliability-weighted moments over age ≥ 25 / PER ≠ 0 season rows.
 */
function preparePool(statList) {
	const pool = emptyPool();
	if (!statList.length) {
		return pool;
	}

	const accMin = (get, m) => {
		for (const s of statList) {
			if (s.min < CONFIG.minutesFloor) {
				continue;
			}
			const tmin = s.min * s.gp;
			m.add(get(s), tmin / (tmin + CONFIG.regressMinK));
		}
		m.finalize();
	};

	accMin((s) => s.usgp, pool.usg);
	accMin((s) => s.astp, pool.ast);
	accMin((s) => s.trbp, pool.trb);
	accMin((s) => s.orbp, pool.orb);
	accMin((s) => s.stlp, pool.stl);
	accMin((s) => s.blkp, pool.blk);
	accMin((s) => s.obpm, pool.obpm);
	accMin((s) => s.dbpm, pool.dbpm);
	accMin((s) => s.ortg, pool.ortg);
	accMin((s) => s.per, pool.per);
	accMin((s) => s.min, pool.mpg);
	accMin((s) => s.availability, pool.avail);
	accMin((s) => s.obpm + s.dbpm, pool.bpm);
	accMin((s) => tovRate(s), pool.tovr);
	accMin((s) => s.fgaAtRim, pool.rimVol);
	accMin((s) => s.fgaLowPost, pool.postVol);
	accMin((s) => s.fgaMidRange, pool.midVol);
	accMin((s) => s.tpa, pool.tpVol);

	const accEff = (pct, att, m) => {
		for (const s of statList) {
			const a = att(s) * s.gp;
			if (a < CONFIG.effAttMin) {
				continue;
			}
			m.add(pct(s), a / (a + CONFIG.regressAttK));
		}
		m.finalize();
	};

	accEff(
		(s) => zdiv(s.fgAtRim, s.fgaAtRim),
		(s) => s.fgaAtRim,
		pool.rimPct,
	);
	accEff(
		(s) => zdiv(s.fgLowPost, s.fgaLowPost),
		(s) => s.fgaLowPost,
		pool.postPct,
	);
	accEff(
		(s) => zdiv(s.fgMidRange, s.fgaMidRange),
		(s) => s.fgaMidRange,
		pool.midPct,
	);
	accEff(
		(s) => zdiv(s.tp, s.tpa),
		(s) => s.tpa,
		pool.tpPct,
	);
	accEff(
		(s) => zdiv(s.ft, s.fta),
		(s) => s.fta,
		pool.ftPct,
	);

	return pool;
}

function shrink(raw, mean, sample, K) {
	return (raw * sample + mean * K) / (sample + K);
}

function zRate(raw, m, totalMin) {
	return (shrink(raw, m.mean, totalMin, CONFIG.regressMinK) - m.mean) / m.sd;
}

function zEff(raw, m, totalAtt) {
	return (shrink(raw, m.mean, totalAtt, CONFIG.regressAttK) - m.mean) / m.sd;
}

function zscores(s, pool) {
	const tmin = s.min * s.gp;
	const att = (perGame) => perGame * s.gp;
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

function productionP(s, pool) {
	const tmin = s.min * s.gp;
	const P =
		CONFIG.prodWBpm * zRate(s.obpm + s.dbpm, pool.bpm, tmin) +
		CONFIG.prodWPer * zRate(s.per, pool.per, tmin);
	return clamp(P, -CONFIG.prodZCap, CONFIG.prodZCap);
}

function globalSignal(age, P) {
	const youthTalent = clamp(
		1.0 + CONFIG.youthTalentK * P,
		CONFIG.youthTalentFloor,
		CONFIG.youthTalentCap,
	);
	const youthBase =
		CONFIG.youthRate * Math.max(0.0, CONFIG.youngKnee - age) * youthTalent;
	const declineBase = CONFIG.oldRate * Math.max(0.0, age - CONFIG.oldKnee);
	const resist = clamp(
		1.0 - CONFIG.declineW * P,
		CONFIG.minResist,
		CONFIG.maxResist,
	);
	return youthBase - declineBase * resist;
}

function gainFactor(ovr) {
	return clamp(
		(CONFIG.softCeil + CONFIG.ceilBand - ovr) / CONFIG.ceilBand,
		0.0,
		1.0,
	);
}

function noiseMult(mpg) {
	const m = Math.max(CONFIG.noiseFloor, mpg);
	return Math.min(Math.sqrt(CONFIG.noiseRefMpg / m), CONFIG.noiseMultCap);
}

function statNudge(a, z) {
	switch (a) {
		case ATTR.dIQ:
			return 0.4 * z.stl + 0.3 * z.blk + 0.3 * z.dbpm;
		case ATTR.Dnk:
			return 0.55 * z.rimPct + 0.3 * z.rimVol;
		case ATTR.Drb:
			return 0.4 * z.ast + 0.2 * z.usg - 0.3 * z.tovr;
		case ATTR.End:
			return 0.45 * z.mpg + 0.25 * z.avail;
		case ATTR.TwoPt:
			return 0.55 * z.midPct + 0.2 * z.midVol;
		case ATTR.FT:
			return 0.65 * z.ftPct;
		case ATTR.Ins:
			return 0.5 * z.postPct + 0.3 * z.postVol + 0.1 * z.orb;
		case ATTR.Jmp:
			return 0.35 * z.blk + 0.25 * z.orb + 0.2 * z.rimVol;
		case ATTR.oIQ:
			return 0.5 * z.obpm + 0.3 * z.ast + 0.1 * z.ortg;
		case ATTR.Pss:
			return 0.65 * z.ast + 0.15 * z.obpm - 0.2 * z.tovr;
		case ATTR.Reb:
			return 0.55 * z.trb + 0.25 * z.orb;
		case ATTR.Spd:
			return 0.25 * z.stl + 0.15 * z.ast;
		case ATTR.Str:
			return 0.35 * z.postVol + 0.3 * z.orb + 0.2 * z.dbpm;
		case ATTR.ThreePt:
			return 0.55 * z.tpPct + 0.25 * z.tpVol;
		default:
			return 0.0;
	}
}

function godChance(ovr) {
	let scale;
	if (ovr < CONFIG.godMinRating) {
		scale = 1.0;
	} else if (ovr > CONFIG.godMaxRating) {
		scale = 0.01;
	} else {
		scale =
			1.0 -
			(ovr - CONFIG.godMinRating) / (CONFIG.godMaxRating - CONFIG.godMinRating);
	}
	return scale * CONFIG.godMaxChance;
}

/**
 * Progress one watched player. age < 25 or per <= 0 → skip (BBGM progs stand).
 * Returns { godProg, delta, ovr } or null if skipped.
 */
function progressPlayer(p, s, pool, ratings) {
	const SZN = bbgm.g.get('season');
	const age = SZN - p.born.year;
	let ovr = ratings.ovr;

	if (age < 25 || s.per <= 0) {
		return null;
	}

	const delta = {};

	// v4.3: god prog first (same chance curve)
	if (age < CONFIG.godYoungMax) {
		const chance = godChance(ovr);
		if (Math.random() < chance) {
			const bonus = randIntInclusive(CONFIG.godMinBonus, CONFIG.godMaxBonus);
			for (let a = 0; a < 15; a++) {
				if (a === ATTR.Hgt) {
					continue;
				}
				const key = ATTR_KEYS[a];
				const before = ratings[key];
				ratings[key] = bbgm.player.limitRating(before + bonus);
				delta[key] = ratings[key] - before;
			}
			ovr = bbgm.player.ovr(ratings);
			ratings.ovr = ovr;
			return { godProg: true, delta, ovr, age };
		}
	}

	const P = productionP(s, pool);
	const nmult = noiseMult(s.min);
	const commonShock = unitNoise() * CONFIG.commonNoise * nmult;
	const Gage = globalSignal(age, P) * CONFIG.globalScale;
	const z = zscores(s, pool);
	const gf = gainFactor(ovr);
	const namp = CONFIG.noiseAmp * nmult;

	for (let a = 0; a < 15; a++) {
		if (a === ATTR.Hgt) {
			continue;
		}
		const ageShape = CONFIG.ageShapeSlope[a] * (age - CONFIG.agePivot);
		const nudge = clamp(
			CONFIG.nudgeGain * statNudge(a, z),
			-CONFIG.nudgeCap,
			CONFIG.nudgeCap,
		);
		const L = ageShape + nudge;
		const noise = unitNoise() * namp;
		const base = a === ATTR.oIQ || a === ATTR.dIQ ? 0.0 : Gage;
		let d = base + commonShock + L + noise;
		if (d > 0.0) {
			d *= gf;
		}
		const key = ATTR_KEYS[a];
		const before = ratings[key];
		ratings[key] = bbgm.player.limitRating(before + d);
		delta[key] = ratings[key] - before;
	}

	ovr = bbgm.player.ovr(ratings);
	ratings.ovr = ovr;
	return { godProg: false, delta, ovr, age };
}

let godProgCount = 0;

async function compileProgs() {
	const players = await bbgm.idb.cache.players.getAll();
	const SZN = bbgm.g.get('season');
	const seasonYr = SZN - 1;

	// Preparation and mutation share structural eligibility. Negative PER is pool-only.
	const eligible = players.filter(
		(p) =>
			Number.isInteger(p.tid) &&
			p.tid >= -1 &&
			Number.isInteger(p.born?.year) &&
			p.born.year > 0 &&
			SZN - p.born.year >= 25 &&
			Array.isArray(p.ratings) &&
			p.ratings.length > 0,
	);
	const poolStats = [];
	for (const p of eligible) {
		const s = statsFor(p, seasonYr);
		if (s) {
			poolStats.push(s);
		}
	}
	const pool = preparePool(poolStats);

	// Pass 2: progress watched 25+ only (under-25 keep BBGM progs untouched)
	for (const p of eligible) {
		if (p.watch !== 1 || p.draft?.year === seasonYr) {
			continue;
		}

		const age = SZN - p.born.year;
		if (age < 25) {
			continue;
		}

		const s = statsFor(p, seasonYr);
		if (!s || s.per <= 0) {
			await sendProgNotification({
				player: p,
				per: s?.per ?? 0,
				ovr: p.ratings?.at?.(-1)?.ovr,
				age,
				delta: null,
				godProg: false,
			});
			continue;
		}

		if (p.ratings.length < 2) {
			continue;
		}

		// Undo BBGM's just-applied ratings row; rebuild from prior season base
		p.ratings.pop();
		bbgm.player.addRatingsRow(p);
		const ratings = p.ratings.at(-1);

		const result = progressPlayer(p, s, pool, ratings);
		if (!result) {
			await bbgm.idb.cache.players.put(p);
			continue;
		}

		if (result.godProg) {
			godProgCount += 1;
		}

		await sendProgNotification({
			player: p,
			per: s.per,
			ovr: result.ovr,
			age: result.age,
			delta: result.delta,
			godProg: result.godProg,
		});

		await bbgm.player.develop(p, 0);
		await bbgm.player.updateValues(p);
		await bbgm.idb.cache.players.put(p);
	}
}

const logGodProgs = async () => {
	await bbgm.logEvent({
		type: 'God Progs',
		text: `God Prog Count This Run: ${godProgCount}`,
		showNotification: true,
		persistent: false,
		score: 20,
		pids: [0],
	});
};

await compileProgs();
await logGodProgs();
