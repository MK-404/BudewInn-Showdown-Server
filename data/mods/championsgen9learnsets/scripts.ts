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
 *   all - the ~130 old-gen returnees and every Mega Evolution forme
 *   Champions brings back - have no real Gen 9 learnset data to fall back
 *   on (none of their moves carry a "9" tag anywhere), so for those we keep
 *   Champions' own synthetic learnset; replacing it would leave them with
 *   almost no legal moves.
 * - species/moves/items: Champions marks a lot of these `isNonstandard`
 *   ("Past") that Gen 9 itself allows, which would otherwise punch holes in
 *   the Gen 9 learnsets we just restored (e.g. King's Shield, Stormthrow).
 *   But Champions *also* deliberately un-restricts things Gen 9 marks "Past"
 *   that don't exist in Gen 9 proper at all (Mega Evolution and ~130 species,
 *   ~75 items, ~9 moves that go with it) - those must stay available. So
 *   availability here is the union of what either side allows: something is
 *   only left restricted if *both* Gen 9 and Champions restrict it.
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
				delete this.modData(dataType, id).isNonstandard;
			}
		}
	},
};
