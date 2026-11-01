export enum StepSweeperPhase { Intro, Playing, Won, Lost }

/** Owns global game phase, timing, steps, and restart generation. */
export class StepSweeperGameState {
  phase = StepSweeperPhase.Intro
  startedAt = 0
  finishedAt = 0
  steps = 0
  generation = 0

  start(): void {
    this.phase = StepSweeperPhase.Playing
    this.startedAt = getTime()
    this.finishedAt = 0
    this.steps = 0
    this.generation++
  }

  finish(won: boolean): void {
    if (this.phase !== StepSweeperPhase.Playing) return
    this.phase = won ? StepSweeperPhase.Won : StepSweeperPhase.Lost
    this.finishedAt = getTime()
  }

  elapsed(): number {
    if (this.phase === StepSweeperPhase.Intro) return 0
    return Math.max(0, (this.finishedAt > 0 ? this.finishedAt : getTime()) - this.startedAt)
  }
}

