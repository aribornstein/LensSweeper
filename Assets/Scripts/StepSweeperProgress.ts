export type StepSweeperDifficultyId = "EASY" | "STANDARD" | "EXPERT"

export type StepSweeperDifficulty = {
  id: StepSweeperDifficultyId
  rows: number
  columns: number
  cellSizeCm: number
  mineCount: number
  scoreMultiplier: number
}

export type StepSweeperWinProgress = {
  bestSeconds: number | null
  isNewBest: boolean
  wins: number
  score: number
}

export const STEP_SWEEPER_DIFFICULTIES: StepSweeperDifficulty[] = [
  {id: "EASY", rows: 5, columns: 5, cellSizeCm: 44, mineCount: 4, scoreMultiplier: 1},
  {id: "STANDARD", rows: 6, columns: 6, cellSizeCm: 50, mineCount: 6, scoreMultiplier: 1.6},
  {id: "EXPERT", rows: 7, columns: 7, cellSizeCm: 42, mineCount: 10, scoreMultiplier: 2.4},
]

const LAST_DIFFICULTY_KEY = "step_sweeper.last_difficulty"

/** Persistent local progression, intentionally independent from game/UI code. */
export class StepSweeperProgress {
  private store = global.persistentStorageSystem.store

  loadDifficultyIndex(): number {
    if (!this.store.has(LAST_DIFFICULTY_KEY)) return 1
    const id = this.store.getString(LAST_DIFFICULTY_KEY) as StepSweeperDifficultyId
    const index = STEP_SWEEPER_DIFFICULTIES.findIndex(item => item.id === id)
    return index >= 0 ? index : 1
  }

  saveDifficulty(id: StepSweeperDifficultyId): void {
    this.store.putString(LAST_DIFFICULTY_KEY, id)
  }

  bestSeconds(id: StepSweeperDifficultyId): number | null {
    const key = this.bestKey(id)
    return this.store.has(key) ? this.store.getInt(key) : null
  }

  wins(id: StepSweeperDifficultyId): number {
    const key = this.winsKey(id)
    return this.store.has(key) ? this.store.getInt(key) : 0
  }

  recordWin(difficulty: StepSweeperDifficulty, elapsedSeconds: number, steps: number): StepSweeperWinProgress {
    const seconds = Math.max(1, Math.round(elapsedSeconds))
    const previousBest = this.bestSeconds(difficulty.id)
    const isNewBest = previousBest === null || seconds < previousBest
    const bestSeconds = isNewBest ? seconds : previousBest
    const wins = this.wins(difficulty.id) + 1
    const paceBonus = Math.max(0, 900 - seconds * 6)
    const efficiencyBonus = Math.max(0, difficulty.rows * difficulty.columns * 15 - steps * 4)
    const score = Math.round((1000 + paceBonus + efficiencyBonus) * difficulty.scoreMultiplier)
    if (isNewBest) this.store.putInt(this.bestKey(difficulty.id), seconds)
    this.store.putInt(this.winsKey(difficulty.id), wins)
    return {bestSeconds, isNewBest, wins, score}
  }

  private bestKey(id: StepSweeperDifficultyId): string { return `step_sweeper.best.${id}` }
  private winsKey(id: StepSweeperDifficultyId): string { return `step_sweeper.wins.${id}` }
}
