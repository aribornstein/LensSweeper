import {StepSweeperBoardManager} from "./StepSweeperBoardManager"
import {StepSweeperCellData} from "./StepSweeperCellData"

/** Converts projected world positions into board coordinates and emits transitions once. */
export class StepSweeperPlayerGridTracker {
  private lastIndex = -1

  constructor(
    private board: StepSweeperBoardManager,
    private boardRoot: SceneObject,
  ) {}

  reset(): void { this.lastIndex = -1 }

  track(worldPosition: vec3): StepSweeperCellData | null {
    const local = this.boardRoot.getTransform().getInvertedWorldTransform().multiplyPoint(worldPosition)
    const column = Math.floor(local.x / this.board.cellSizeCm + this.board.columns * 0.5)
    const row = Math.floor(this.board.rows * 0.5 - local.z / this.board.cellSizeCm)
    const cell = this.board.cell(row, column)
    if (!cell) {
      this.lastIndex = -1
      return null
    }
    const index = this.board.index(cell)
    if (index === this.lastIndex) return null
    this.lastIndex = index
    return cell
  }

  current(worldPosition: vec3): StepSweeperCellData | null {
    const local = this.boardRoot.getTransform().getInvertedWorldTransform().multiplyPoint(worldPosition)
    return this.board.cell(
      Math.floor(this.board.rows * 0.5 - local.z / this.board.cellSizeCm),
      Math.floor(local.x / this.board.cellSizeCm + this.board.columns * 0.5),
    )
  }
}

