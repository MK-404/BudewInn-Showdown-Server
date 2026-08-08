/**
 * Champions, but with standard Gen 9 learnsets.
 *
 * Inherits everything from the `champions` mod (move/ability/item rebalances,
 * the 20 PP cap, Level Clause Mod stat calc, ...) and then undoes the
 * *availability* restrictions Champions layers on top of Gen 9:
 *
 * - learnsets: Champions ships its own trimmed `learnsets.ts` with every move
 *   synthetically tagged "9M", sidestepping the real cross-gen transfer
 *   rules entirely. For species Gen 9 natively supports, we swap in the
 *   real (and much larger) Gen 9 movepool. Species Gen 9 doesn't support at
 *   all - Mega Evolution formes and the handful of old-gen species Champions
 *   brings back purely to carry a Mega Evolution - have no real Gen 9
 *   learnset data to fall back on (none of their moves carry a "9" tag
 *   anywhere), so for those we keep Champions' own synthetic learnset;
 *   replacing it would leave them with almost no legal moves.
 * - moves/items: Champions marks a lot of these `isNonstandard` ("Past")
 *   that Gen 9 itself allows, which would otherwise punch holes in the Gen 9
 *   learnsets we just restored (e.g. King's Shield, Stormthrow). But
 *   Champions *also* deliberately un-restricts things Gen 9 marks "Past"
 *   that don't exist in Gen 9 proper (Mega Stones and a few moves that go
 *   with reintroduced Pokémon) - those must stay available. So availability
 *   here is the union of what either side allows: something is only left
 *   restricted if *both* Gen 9 and Champions restrict it.
 * - species: every Pokémon either side allows is usable (same union as
 *   moves/items), PLUS every species tagged "Past" even when *both* sides
 *   restrict it (Mantine, ~360 others - like National Dex's "+Past" rule,
 *   which is the actual behavior being matched here; "Future"/"CAP"/"LGPE"/
 *   "Custom" species stay restricted, same as National Dex). The format's
 *   ruleset is what restricts *mechanics* to Mega Evolution only (Z-Moves
 *   banned via Z-Move Clause; Dynamax/Max Moves don't exist in this dex to
 *   begin with) - it's not meant to make any Pokémon unusable.
 *   Champions sometimes only curates the final evolution of a line (e.g.
 *   Machamp, but not Machop/Machoke) - once a species is available, its
 *   whole prevo chain is force-unlocked too, tagged "NFE", since otherwise
 *   you could own the final forme but never legally breed/level into it.
 *   Those prevos need a synthetic Gen 9 learnset the same way Champions'
 *   own reintroduced species do (see below), since neither side has one.
 *
 *   Non-availability fields (base power, PP, effects, tiers, ...) are left
 *   exactly as Champions defines them.
 *
 *   This reads `dex.data[dataType][id]` directly rather than through
 *   `dex.moves.get()`/`dex.species.get()`/`dex.items.get()`: those getters
 *   cache their result for the lifetime of the ModdedDex, so resolving
 *   through them here would freeze every later lookup at its pre-mutation
 *   value instead of picking up what this function just unlocked.
 */
export const Scripts: ModdedBattleScriptsData = {
	inherit: 'champions',
	gen: 9,
	// Champions' own statModify (inherited otherwise) drops the standard "EVs
	// divide by 4" step entirely - it's built for its own 0-32 Stat Points
	// system, where 252 EVs would translate into a flat, game-breaking +252 to
	// the stat. Since this mod uses the standard 0-252/510 EV system (see
	// team-validator.ts's useStatPoints and dex-formats.ts's evLimit, both of
	// which special-case this mod's name), the stat formula needs to be
	// standard too. This is a verbatim copy of the un-modded Gen 9 formula
	// (sim/battle.ts's Battle#statModify).
	statModify(baseStats, set, statName) {
		const tr = this.trunc;
		let stat = baseStats[statName];
		if (statName === 'hp') {
			return tr(tr(2 * stat + set.ivs[statName] + tr(set.evs[statName] / 4) + 100) * set.level / 100 + 10);
		}
		stat = tr(tr(2 * stat + set.ivs[statName] + tr(set.evs[statName] / 4)) * set.level / 100 + 5);
		const nature = this.dex.natures.get(set.nature);
		if (nature.plus === statName) {
			stat = this.ruleTable.has('overflowstatmod') ? Math.min(stat, 595) : stat;
			stat = tr(tr(stat * 110, 16) / 100);
		} else if (nature.minus === statName) {
			stat = this.ruleTable.has('overflowstatmod') ? Math.min(stat, 728) : stat;
			stat = tr(tr(stat * 90, 16) / 100);
		}
		return stat;
	},
	init() {
		const baseDex = this.mod('base');

		for (const id in this.data.Learnsets) {
			if (baseDex.species.get(id).isNonstandard) continue;
			const baseLearnset = baseDex.data.Learnsets[id];
			if (baseLearnset) this.data.Learnsets[id] = baseLearnset;
		}

		for (const dataType of ['FormatsData', 'Moves', 'Items'] as const) {
			const ownTable = this.data[dataType] as AnyObject;
			const baseTable = baseDex.data[dataType] as AnyObject;
			for (const id in ownTable) {
				if (!ownTable[id]?.isNonstandard) continue;
				if (baseTable[id]?.isNonstandard) continue;
				const entry = this.modData(dataType, id);
				delete entry.isNonstandard;
				// Champions restricts this species (Arceus formes, etc.) while
				// Gen 9 doesn't, so its "tier" field is still Champions' stale
				// "Illegal" - swap in Gen 9's own tier now that it's available.
				if (dataType === 'FormatsData' && baseTable[id]?.tier) entry.tier = baseTable[id].tier;
			}
		}

		// Species tagged "Past" (unlike "Future"/"CAP"/"LGPE"/"Custom") are
		// unlocked even when both Gen 9 and Champions restrict them - matching
		// National Dex's "+Past" rule (dex-formats.ts's Obtainable check treats
		// them the same way once that rule/tag is active). Gen 9's National Dex
		// tier is the natural fit here when it has one.
		for (const id in this.data.FormatsData) {
			const entry = this.data.FormatsData[id] as AnyObject;
			if (entry?.isNonstandard !== 'Past') continue;
			const owned = this.modData('FormatsData', id);
			delete owned.isNonstandard;
			const baseEntry = baseDex.data.FormatsData[id] as AnyObject | undefined;
			owned.tier = baseEntry?.natDexTier || baseEntry?.tier || owned.tier;
		}

		// Force-unlock any still-restricted prevo of a now-available species
		// (Machop/Machoke for Machamp, ...), and give it a synthetic Gen 9
		// learnset the same way Champions tags its own reintroduced species,
		// since neither Gen 9 nor Champions has real Gen 9 data for it either.
		const pokedex = this.data.Pokedex as AnyObject;
		for (const id in this.data.FormatsData) {
			if ((this.data.FormatsData[id] as AnyObject)?.isNonstandard) continue;
			let prevoName = pokedex[id]?.prevo;
			while (prevoName) {
				const prevoId = this.toID(prevoName);
				const prevoFormatsData = this.data.FormatsData[prevoId] as AnyObject | undefined;
				if (!prevoFormatsData?.isNonstandard) break; // already available (or no entry to fix)
				const entry = this.modData('FormatsData', prevoId);
				delete entry.isNonstandard;
				entry.tier = 'NFE';

				const learnset = (this.data.Learnsets[prevoId] as AnyObject | undefined)?.learnset as AnyObject | undefined;
				if (learnset && !Object.values(learnset).some((tags: any) => tags.includes('9M'))) {
					const learnsetEntry = this.modData('Learnsets', prevoId);
					for (const moveid in learnsetEntry.learnset) learnsetEntry.learnset[moveid] = ['9M'];
				}

				prevoName = pokedex[prevoId]?.prevo;
			}
		}
	},
};
