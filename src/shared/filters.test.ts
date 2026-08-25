import { describe, expect, test } from "bun:test";
import {
  ALL_UNIVERSES,
  NO_UNIVERSE_FILTER,
  isNothingSelected,
  normalizeSelection,
  parseSubuniverseKey,
  selectionCounts,
  selectionParams,
  selectionsEqual,
  subuniverseKey,
  type UniverseSelection,
} from "./filters";
import type { UniverseOption } from "./types";

function universe(
  identifier: string,
  ...subuniverses: string[]
): UniverseOption {
  return {
    identifier,
    name: identifier,
    subuniverses: subuniverses.map((sub) => ({ identifier: sub, name: sub })),
  };
}

const TREE: UniverseOption[] = [
  universe("wine-and-spirits", "vins", "spiritueux", "bieres"),
  universe("qooking", "cuisine", "boissons"),
  universe("qontour", "voyages"),
];

const EVERY_UNIVERSE = TREE.map((option) => option.identifier);

const EVERY_SUBUNIVERSE = TREE.flatMap((option) =>
  option.subuniverses.map((sub) =>
    subuniverseKey(option.identifier, sub.identifier)
  )
);

function custom(
  universes: string[],
  subuniverses: string[] = []
): UniverseSelection {
  return { mode: "custom", universes, subuniverses };
}

const NOTHING = custom([], []);

function entriesOf(selection: UniverseSelection): {
  universes: string[];
  subuniverses: string[];
} {
  if (selection.mode !== "custom") {
    throw new Error(`expected a custom selection, got mode "${selection.mode}"`);
  }
  return {
    universes: [...selection.universes].sort(),
    subuniverses: [...selection.subuniverses].sort(),
  };
}

describe("sub-universe keys", () => {
  test("keeps one sub-universe identifier apart under two universes", () => {
    expect(subuniverseKey("wine-and-spirits", "vins")).not.toBe(
      subuniverseKey("alcohol", "vins")
    );
    expect(parseSubuniverseKey(subuniverseKey("alcohol", "vins"))).toEqual({
      universe: "alcohol",
      subuniverse: "vins",
    });
  });

  test("splits on the first separator, so a sub-universe may contain one", () => {
    expect(subuniverseKey("qooking", "art:de:vivre")).toBe(
      "qooking:art:de:vivre"
    );
    expect(parseSubuniverseKey("qooking:art:de:vivre")).toEqual({
      universe: "qooking",
      subuniverse: "art:de:vivre",
    });
  });

  test("reports no universe for a key written before keys were namespaced", () => {
    expect(parseSubuniverseKey("vins")).toEqual({
      universe: null,
      subuniverse: "vins",
    });
  });
});

describe("the three selection states", () => {
  test("tells an empty selection apart from all universes", () => {
    expect(isNothingSelected(ALL_UNIVERSES)).toBe(false);
    expect(isNothingSelected(NOTHING)).toBe(true);
  });

  test("does not read a subset as empty", () => {
    expect(isNothingSelected(custom(["qooking"]))).toBe(false);
    expect(isNothingSelected(custom([], ["qooking:cuisine"]))).toBe(false);
  });

  test("never conflates all universes with a selection naming every universe", () => {
    const everyUniverse = custom(EVERY_UNIVERSE);
    expect(selectionsEqual(ALL_UNIVERSES, everyUniverse)).toBe(false);
    expect(selectionParams(ALL_UNIVERSES)).not.toEqual(
      selectionParams(everyUniverse)
    );
  });
});

describe("comparing two selections", () => {
  test("ignores the order the entries were picked in", () => {
    const first = custom(
      ["qooking", "qontour"],
      ["wine-and-spirits:vins", "wine-and-spirits:bieres"]
    );
    const second = custom(
      ["qontour", "qooking"],
      ["wine-and-spirits:bieres", "wine-and-spirits:vins"]
    );
    expect(selectionsEqual(first, second)).toBe(true);
  });

  test("sees an added, a removed and a swapped entry", () => {
    expect(
      selectionsEqual(custom(["qooking"]), custom(["qooking", "qontour"]))
    ).toBe(false);
    expect(selectionsEqual(custom(["qooking"]), custom(["qontour"]))).toBe(
      false
    );
    expect(
      selectionsEqual(
        custom(["qooking"], ["qontour:voyages"]),
        custom(["qooking"])
      )
    ).toBe(false);
  });

  test("separates the empty selection from every other state", () => {
    expect(selectionsEqual(NOTHING, ALL_UNIVERSES)).toBe(false);
    expect(selectionsEqual(NOTHING, custom(["qooking"]))).toBe(false);
    expect(selectionsEqual(NOTHING, NOTHING)).toBe(true);
  });
});

describe("what the picker label counts", () => {
  test("counts a whole universe once, whatever it holds", () => {
    expect(selectionCounts(custom(["wine-and-spirits"]))).toEqual({
      universes: 1,
      subuniverses: 0,
    });
  });

  test("counts sub-universes on their own side of the label", () => {
    expect(
      selectionCounts(
        custom([], ["wine-and-spirits:vins", "wine-and-spirits:spiritueux"])
      )
    ).toEqual({ universes: 0, subuniverses: 2 });
    expect(
      selectionCounts(custom(["qooking"], ["wine-and-spirits:vins"]))
    ).toEqual({ universes: 1, subuniverses: 1 });
  });

  test("counts nothing in all mode, so the label is a name and not a number", () => {
    expect(selectionCounts(ALL_UNIVERSES)).toEqual({
      universes: 0,
      subuniverses: 0,
    });
    expect(selectionCounts(NOTHING)).toEqual({
      universes: 0,
      subuniverses: 0,
    });
  });

  test("never counts more entries than the picker draws boxes for", () => {
    const stored = custom(
      ["qooking", "alcohol"],
      ["alcohol:vins", "wine-and-spirits:vins"]
    );
    expect(selectionCounts(normalizeSelection(stored, TREE))).toEqual({
      universes: 1,
      subuniverses: 1,
    });
  });

  test("counts a fully ticked universe as one universe, not as its parts", () => {
    const stored = custom(["qontour"], ["qooking:cuisine", "qooking:boissons"]);
    expect(selectionCounts(normalizeSelection(stored, TREE))).toEqual({
      universes: 2,
      subuniverses: 0,
    });
  });
});

describe("turning a selection into query parameters", () => {
  test("sends no universe parameter at all for all universes", () => {
    expect(selectionParams(ALL_UNIVERSES)).toEqual({});
  });

  test("sends the reserved marker for an empty selection, never an empty filter", () => {
    const params = selectionParams(NOTHING);
    expect(params.universes).toEqual([NO_UNIVERSE_FILTER]);
    expect(NO_UNIVERSE_FILTER).toBe("__none__");
    expect(params.subuniverses).toBeUndefined();
  });

  test("leaves out the side of the filter that has no entries", () => {
    const universesOnly = selectionParams(custom(["qooking", "qontour"]));
    expect(universesOnly.universes).toEqual(["qooking", "qontour"]);
    expect(universesOnly.subuniverses).toBeUndefined();

    const subuniversesOnly = selectionParams(custom([], ["qooking:cuisine"]));
    expect(subuniversesOnly.universes).toBeUndefined();
    expect(subuniversesOnly.subuniverses).toEqual(["qooking:cuisine"]);
  });

  test("sends both sides of a mixed selection", () => {
    expect(
      selectionParams(custom(["qontour"], ["qooking:cuisine"]))
    ).toEqual({
      universes: ["qontour"],
      subuniverses: ["qooking:cuisine"],
    });
  });
});

describe("normalizing a selection against the universe tree", () => {
  test("leaves all universes untouched", () => {
    expect(normalizeSelection(ALL_UNIVERSES, TREE)).toEqual(ALL_UNIVERSES);
    expect(normalizeSelection(ALL_UNIVERSES, [])).toEqual(ALL_UNIVERSES);
  });

  test("keeps a stored selection while the universe tree is still loading", () => {
    const stored = custom(["alcohol"], ["alcohol:vins"]);
    expect(normalizeSelection(stored, [])).toEqual(stored);
    expect(normalizeSelection(stored, TREE)).toEqual(ALL_UNIVERSES);
  });

  test("drops a universe the tree no longer lists", () => {
    expect(
      entriesOf(normalizeSelection(custom(["qooking", "alcohol"]), TREE))
    ).toEqual({ universes: ["qooking"], subuniverses: [] });
  });

  test("drops a sub-universe whose universe disappeared", () => {
    expect(
      entriesOf(normalizeSelection(custom(["qooking"], ["alcohol:vins"]), TREE))
    ).toEqual({ universes: ["qooking"], subuniverses: [] });
  });

  test("drops a sub-universe that was re-filed under another universe", () => {
    expect(
      entriesOf(normalizeSelection(custom(["qooking"], ["qontour:vins"]), TREE))
    ).toEqual({ universes: ["qooking"], subuniverses: [] });
  });

  test("drops a sub-universe key written before keys were namespaced", () => {
    expect(
      entriesOf(normalizeSelection(custom(["qooking"], ["vins"]), TREE))
    ).toEqual({ universes: ["qooking"], subuniverses: [] });
  });

  test("drops a sub-universe its own universe already covers", () => {
    const stored = custom(["wine-and-spirits"], ["wine-and-spirits:vins"]);
    expect(entriesOf(normalizeSelection(stored, TREE))).toEqual({
      universes: ["wine-and-spirits"],
      subuniverses: [],
    });
  });

  test("collapses a universe whose sub-universes are all ticked", () => {
    const stored = custom([], [
      "wine-and-spirits:vins",
      "wine-and-spirits:spiritueux",
      "wine-and-spirits:bieres",
    ]);
    expect(entriesOf(normalizeSelection(stored, TREE))).toEqual({
      universes: ["wine-and-spirits"],
      subuniverses: [],
    });
  });

  test("keeps a partly ticked universe as its individual sub-universes", () => {
    const stored = custom([], [
      "wine-and-spirits:vins",
      "wine-and-spirits:bieres",
    ]);
    expect(entriesOf(normalizeSelection(stored, TREE))).toEqual({
      universes: [],
      subuniverses: ["wine-and-spirits:bieres", "wine-and-spirits:vins"],
    });
  });

  test("collapses only the universe that is fully ticked", () => {
    const stored = custom([], [
      "qooking:cuisine",
      "qooking:boissons",
      "wine-and-spirits:vins",
    ]);
    expect(entriesOf(normalizeSelection(stored, TREE))).toEqual({
      universes: ["qooking"],
      subuniverses: ["wine-and-spirits:vins"],
    });
  });

  test("reaches all universes once every universe is ticked", () => {
    expect(normalizeSelection(custom(EVERY_UNIVERSE), TREE)).toEqual(
      ALL_UNIVERSES
    );
  });

  test("reaches all universes when every box is ticked one sub-universe at a time", () => {
    expect(normalizeSelection(custom([], EVERY_SUBUNIVERSE), TREE)).toEqual(
      ALL_UNIVERSES
    );
  });

  test("reaches all universes when the last tick completes the last universe", () => {
    const stored = custom(
      ["wine-and-spirits", "qooking"],
      ["qontour:voyages"]
    );
    expect(normalizeSelection(stored, TREE)).toEqual(ALL_UNIVERSES);
  });

  test("stays a subset while one universe is untouched", () => {
    const stored = custom(["wine-and-spirits", "qooking"]);
    expect(entriesOf(normalizeSelection(stored, TREE))).toEqual({
      universes: ["qooking", "wine-and-spirits"],
      subuniverses: [],
    });
  });

  test("stays a subset while the last universe is only partly ticked", () => {
    const stored = custom(["wine-and-spirits", "qontour"], ["qooking:cuisine"]);
    expect(entriesOf(normalizeSelection(stored, TREE))).toEqual({
      universes: ["qontour", "wine-and-spirits"],
      subuniverses: ["qooking:cuisine"],
    });
  });

  test("recovers to all universes when every stored entry went stale", () => {
    const stored = custom(["alcohol"], ["alcohol:vins", "vins"]);
    expect(normalizeSelection(stored, TREE)).toEqual(ALL_UNIVERSES);
  });

  test("keeps the surviving entries when only some went stale", () => {
    const stored = custom(
      ["alcohol", "qontour"],
      ["alcohol:vins", "qooking:cuisine"]
    );
    expect(entriesOf(normalizeSelection(stored, TREE))).toEqual({
      universes: ["qontour"],
      subuniverses: ["qooking:cuisine"],
    });
  });

  test("leaves a deliberately empty selection empty", () => {
    const normalized = normalizeSelection(NOTHING, TREE);
    expect(isNothingSelected(normalized)).toBe(true);
    expect(selectionsEqual(normalized, ALL_UNIVERSES)).toBe(false);
  });

  test("folds repeated entries into one", () => {
    const stored = custom(
      ["qooking", "qooking"],
      ["wine-and-spirits:vins", "wine-and-spirits:vins"]
    );
    expect(entriesOf(normalizeSelection(stored, TREE))).toEqual({
      universes: ["qooking"],
      subuniverses: ["wine-and-spirits:vins"],
    });
  });

  test("settles in one pass, so the dashboard stops renormalizing", () => {
    const stored: UniverseSelection[] = [
      ALL_UNIVERSES,
      NOTHING,
      custom(EVERY_UNIVERSE),
      custom([], EVERY_SUBUNIVERSE),
      custom(["alcohol"], ["alcohol:vins"]),
      custom(["wine-and-spirits"], ["wine-and-spirits:vins"]),
      custom(["qontour"], ["qooking:cuisine", "qooking:boissons"]),
      custom(["qooking", "qooking"], ["vins", "qontour:vins"]),
    ];
    for (const selection of stored) {
      const once = normalizeSelection(selection, TREE);
      const twice = normalizeSelection(once, TREE);
      expect(twice.mode).toBe(once.mode);
      expect(selectionsEqual(twice, once)).toBe(true);
    }
  });
});
