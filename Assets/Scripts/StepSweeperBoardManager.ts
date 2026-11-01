import {StepSweeperCellData} from "./StepSweeperCellData"

/** Owns the board data model, coordinates, mine placement, and adjacency. */
export class StepSweeperBoardManager {
  readonly cells: StepSweeperCellData[] = []
  minesPlaced = false

  constructor(
    readonly rows: number,
    readonly columns: number,
    readonly cellSizeCm: number,
    readonly mineCount: number,
  ) {
    for (let row = 0; row < rows; row++) {
      for (let column = 0; column < columns; column++) {
        this.cells.push(new StepSweeperCellData(row, column))
      }
    }
  }

  reset(): void {
    this.minesPlaced = false
    for (const cell of this.cells) {
      cell.hasMine = false
      cell.adjacentMineCount = 0
      cell.isRevealed = false
      cell.isFlagged = false
    }
  }

  cell(row: number, column: number): StepSweeperCellData | null {
    if (row < 0 || column < 0 || row >= this.rows || column >= this.columns) return null
    return this.cells[row * this.columns + column]
  }

  neighbors(cell: StepSweeperCellData): StepSweeperCellData[] {
    const result: StepSweeperCellData[] = []
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (dr === 0 && dc === 0) continue
        const neighbor = this.cell(cell.row + dr, cell.column + dc)
        if (neighbor) result.push(neighbor)
      }
    }
    return result
  }

  placeMines(first: StepSweeperCellData, seed: number): void {
    if (this.minesPlaced) return
    const forbidden: Record<number, boolean> = {}
    forbidden[this.index(first)] = true
    for (const neighbor of this.neighbors(first)) forbidden[this.index(neighbor)] = true

    const eligible = this.cells.filter((cell) => !forbidden[this.index(cell)])
    let state = seed >>> 0
    const random = (): number => {
      state = (state * 1664525 + 1013904223) >>> 0
      return state / 4294967296
    }
    for (let i = eligible.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1))
      const tmp = eligible[i]
      eligible[i] = eligible[j]
      eligible[j] = tmp
    }
    const count = Math.min(this.mineCount, eligible.length)
    for (let i = 0; i < count; i++) eligible[i].hasMine = true
    for (const cell of this.cells) {
      cell.adjacentMineCount = this.neighbors(cell).filter((neighbor) => neighbor.hasMine).length
    }
    this.minesPlaced = true
  }

  boardLocalPosition(cell: StepSweeperCellData, y: number = 0): vec3 {
    const x = (cell.column - (this.columns - 1) * 0.5) * this.cellSizeCm
    const z = ((this.rows - 1) * 0.5 - cell.row) * this.cellSizeCm
    return new vec3(x, y, z)
  }

  index(cell: StepSweeperCellData): number {
    return cell.row * this.columns + cell.column
  }

  get flagsUsed(): number { return this.cells.filter((cell) => cell.isFlagged).length }
  get revealedSafeCells(): number { return this.cells.filter((cell) => cell.isRevealed && !cell.hasMine).length }
  get totalSafeCells(): number { return this.cells.length - this.mineCount }
}

