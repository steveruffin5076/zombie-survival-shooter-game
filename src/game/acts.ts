/** Act campaign structure: 6 acts × (3 exploration + 1 Terminal Defense) = 24 stages */

export interface ActDef {
  id: number;
  numeral: string;
  name: string;
  sub: string;
  themeId: string;
  arenaThemeId: string;
  bossId: string;
  explorationWaves: number;
  defenseWaves: number;
  worldW: number;
  /** Enemy pool for this act, keyed by ZType id. Acts II–VI may gate certain enemies. */
  enemyPool?: Partial<Record<string, number>>;
}

const WAVES_PER_EXPLORATION = 10;
const WAVES_PER_DEFENSE = 10;

export const ACTS: ActDef[] = [
  {
    id: 1, numeral: "I", name: "GRAVEYARD SHIFT", sub: "midnight at Aetheris Dynamics",
    themeId: "cemetery", arenaThemeId: "arena", bossId: "juggernaut",
    explorationWaves: WAVES_PER_EXPLORATION, defenseWaves: WAVES_PER_DEFENSE, worldW: 2880,
    // Act I enemy pool: common walkers, runners, splitters, and screamer
    enemyPool: { walker: 60, runner: 30, splitter: 20, screamer: 10 },
  },
  {
    id: 2, numeral: "II", name: "WAREHOUSE RUN", sub: "deep storage below",
    themeId: "suburbs", arenaThemeId: "arena", bossId: "juggernaut",
    explorationWaves: WAVES_PER_EXPLORATION, defenseWaves: WAVES_PER_DEFENSE, worldW: 2880,
    // Act II: walkers, runners, splitters, and vaulter
    enemyPool: { walker: 50, runner: 35, splitter: 25, vaulter: 15 },
  },
  {
    id: 3, numeral: "III", name: "INDUSTRIAL COMPLEX", sub: "where they made it",
    themeId: "highway", arenaThemeId: "arena", bossId: "juggernaut",
    explorationWaves: WAVES_PER_EXPLORATION, defenseWaves: WAVES_PER_DEFENSE, worldW: 2880,
    // Act III placeholder
    enemyPool: { walker: 45, runner: 40, splitter: 30, vaulter: 15 },
  },
  {
    id: 4, numeral: "IV", name: "POWERHOUSE", sub: "the source",
    themeId: "highway", arenaThemeId: "arena", bossId: "juggernaut",
    explorationWaves: WAVES_PER_EXPLORATION, defenseWaves: WAVES_PER_DEFENSE, worldW: 2880,
    // Act IV placeholder
    enemyPool: { walker: 40, runner: 40, splitter: 35, vaulter: 20 },
  },
  {
    id: 5, numeral: "V", name: "NEON GRAVEYARD", sub: "where the grid still glows",
    themeId: "suburbs", arenaThemeId: "arena", bossId: "juggernaut",
    explorationWaves: WAVES_PER_EXPLORATION, defenseWaves: WAVES_PER_DEFENSE, worldW: 2880,
    // Act V placeholder
    enemyPool: { walker: 35, runner: 45, splitter: 40, vaulter: 25 },
  },
  {
    id: 6, numeral: "VI", name: "THE REDSHIFT", sub: "the end of the night",
    themeId: "cemetery", arenaThemeId: "arena", bossId: "juggernaut",
    explorationWaves: WAVES_PER_EXPLORATION, defenseWaves: WAVES_PER_DEFENSE, worldW: 2880,
    // Act VI placeholder
    enemyPool: { walker: 30, runner: 50, splitter: 45, vaulter: 30 },
  },
];
