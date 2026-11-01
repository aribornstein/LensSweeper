/** Pure Minesweeper cell state. No rendering or scene access. */
export class StepSweeperCellData {
  readonly row: number
  readonly column: number
  hasMine = false
  adjacentMineCount = 0
  isRevealed = false
  isFlagged = false

  constructor(row: number, column: number) {
    this.row = row
    this.column = column
  }
}

export enum StepSweeperCellEntryResult { Ignored, Reveal, Mine }

/** Resolves walking onto a cell before any rendering or game-state side effects. */
export function resolveStepSweeperCellEntry(cell: StepSweeperCellData): StepSweeperCellEntryResult {
  if (cell.isFlagged || cell.isRevealed) return StepSweeperCellEntryResult.Ignored
  return cell.hasMine ? StepSweeperCellEntryResult.Mine : StepSweeperCellEntryResult.Reveal
}
