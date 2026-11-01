import {StepSweeperBoardManager} from "./StepSweeperBoardManager"
import {StepSweeperCellData} from "./StepSweeperCellData"

/** View-ray targeting and shared flag toggling rules. */
export class StepSweeperFlagInteraction {
  constructor(
    private board: StepSweeperBoardManager,
    private boardRoot: SceneObject,
  ) {}

  targetFromView(cameraObject: SceneObject): StepSweeperCellData | null {
    const cameraTransform = cameraObject.getTransform()
    const origin = cameraTransform.getWorldPosition()
    // Camera optical direction is local -Z (`back` on Lens Transform).
    const direction = cameraTransform.back
    const boardY = this.boardRoot.getTransform().getWorldPosition().y
    if (Math.abs(direction.y) < 0.05) return null
    const distance = (boardY - origin.y) / direction.y
    if (distance <= 0) return null
    const point = origin.add(direction.uniformScale(distance))
    const local = this.boardRoot.getTransform().getInvertedWorldTransform().multiplyPoint(point)
    return this.board.cell(
      Math.floor(this.board.rows * 0.5 - local.z / this.board.cellSizeCm),
      Math.floor(local.x / this.board.cellSizeCm + this.board.columns * 0.5),
    )
  }

  toggle(cell: StepSweeperCellData | null): boolean {
    if (!cell || cell.isRevealed) return false
    cell.isFlagged = !cell.isFlagged
    return true
  }
}
