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
 * - species: same union, but narrower. Champions brings back ~130 old-gen
 *   Pokémon Gen 9 doesn't support, only part of which carry a Mega
 *   Evolution. Only that Mega-related part (Mega formes themselves, and
 *   base species that have one, e.g. Alakazam for Mega Alakazam) is
 *   unlocked here - the Mega mechanic needs it. Old-gen returnees with no
 *   Mega tie (Roserade, Furfrou, Aegislash, Castform, ...) stay Gen
 *   9-only, i.e. unavailable, same as in stock Gen 9.
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

		const pokedex = this.data.Pokedex as AnyObject;
		const isMegaRelated = (id: string): boolean => {
			const entry = pokedex[id];
			if (!entry) return false;
			if ((entry.forme || '').includes('Mega')) return true;
			return (entry.otherFormes || []).some((forme: string) => forme.includes('Mega'));
		};

		for (const dataType of ['Moves', 'Items'] as const) {
			const ownTable = this.data[dataType] as AnyObject;
			const baseTable = baseDex.data[dataType] as AnyObject;
			for (const id in ownTable) {
				if (!ownTable[id]?.isNonstandard) continue;
				if (baseTable[id]?.isNonstandard) continue;
				delete this.modData(dataType, id).isNonstandard;
			}
		}

		// Species availability isn't a simple union: unlike moves/items, Champions
		// leaves most of its ~130 old-gen returnees with *no* isNonstandard entry
		// at all (fully standard as far as Champions' own data is concerned), so
		// there's nothing to "leave alone" - we have to actively restore Gen 9's
		// restriction for the non-Mega ones instead of only ever removing one.
		for (const id in this.data.FormatsData) {
			const baseNonstandard = baseDex.data.FormatsData[id]?.isNonstandard;
			const shouldBeAvailable = !baseNonstandard || isMegaRelated(id);
			const formatsData = this.data.FormatsData[id] as AnyObject;
			if (shouldBeAvailable) {
				if (formatsData?.isNonstandard) delete this.modData('FormatsData', id).isNonstandard;
			} else if (formatsData?.isNonstandard !== baseNonstandard) {
				this.modData('FormatsData', id).isNonstandard = baseNonstandard;
			}
		}
	},
};
