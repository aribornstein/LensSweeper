import {StepSweeperBoardManager} from "./StepSweeperBoardManager"
import {StepSweeperCellData} from "./StepSweeperCellData"

/** Computes standard Minesweeper reveal order, including zero flood-fill boundaries. */
export class StepSweeperRevealSystem {
  constructor(private board: StepSweeperBoardManager) {}

  revealOrder(start: StepSweeperCellData): StepSweeperCellData[] {
    if (start.isRevealed || start.isFlagged || start.hasMine) return []
    const result: StepSweeperCellData[] = []
    const queue: StepSweeperCellData[] = [start]
    const seen: Record<number, boolean> = {}
    seen[this.board.index(start)] = true
    while (queue.length > 0) {
      const cell = queue.shift() as StepSweeperCellData
      if (!cell.isFlagged && !cell.isRevealed) result.push(cell)
      if (cell.adjacentMineCount !== 0) continue
      for (const neighbor of this.board.neighbors(cell)) {
        const index = this.board.index(neighbor)
        if (seen[index] || neighbor.hasMine || neighbor.isFlagged) continue
        seen[index] = true
        queue.push(neighbor)
      }
    }
    return result
  }
}

