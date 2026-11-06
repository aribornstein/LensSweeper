import {StepSweeperBoardManager} from "./StepSweeperBoardManager"
import {StepSweeperCellData} from "./StepSweeperCellData"
import {StepSweeperSpatialClue} from "./StepSweeperSpatialClue"
import {StepSweeperArena} from "./StepSweeperArena"
import {StepSweeperBoardEffects, StepSweeperFlagVisual} from "./StepSweeperBoardEffects"
import {Interactable} from "SpectaclesInteractionKit.lspkg/Components/Interaction/Interactable/Interactable"
import Event from "SpectaclesInteractionKit.lspkg/Utils/Event"

type CellVisual = {
  root: SceneObject
  wash: SceneObject
  washMaterial: Material
  corners: SceneObject
  cornerVisual: RenderMeshVisual
  revealCorners: SceneObject
  revealCornerMaterial: Material
  scan: SceneObject
  clue: StepSweeperSpatialClue
  mine: SceneObject | null
  flag: StepSweeperFlagVisual | null
}
type RevealAnimation = {visual: CellVisual, startedAt: number}
type FloorRect = [number, number, number, number]

/** World-anchored floor information, spatial clues and localized feedback. */
@component
export class StepSweeperCellViewUI extends BaseScriptComponent {
  @ui.label('<span style="color: #22D3EE;">Specs Sweeper board presentation</span>')
  @ui.separator
  @ui.group_start("References")
  @input @hint("Shared unit box mesh for floor washes and scan lines") tileMesh!: RenderMesh
  @input @hint("Unrevealed material reference") unrevealedMaterial!: Material
  @input @hint("Safe reveal material reference") revealedMaterial!: Material
  @input @hint("Mine material reference") mineMaterial!: Material
  @input @hint("Flag material reference") flagMaterial!: Material
  @input @hint("Player highlight material reference") playerHighlightMaterial!: Material
  @input @hint("Target highlight material reference") targetHighlightMaterial!: Material
  @input @hint("Unlit template for floor markings, props and clues") boundaryMaterial!: Material
  @input @hint("Legacy frame material reference") hologramMaterial!: Material
  @input @hint("Legacy scan material reference") scanMaterial!: Material
  @ui.group_end
  @ui.group_start("Floor appearance")
  @input @hint("Covered cell corner-mark color") @widget(new ColorWidget()) floorMarkColor: vec4 = new vec4(0.2, 0.88, 1, 0.7)
  @input @hint("Subtle covered-cell blue wash opacity") @widget(new SliderWidget(0, 0.15, 0.005)) floorWashOpacity: number = 0.075
  @input @hint("Floor grid line opacity") @widget(new SliderWidget(0, 0.8, 0.01)) gridOpacity: number = 0.52
  @input @hint("Floor scan and clue arrival duration, in seconds") @widget(new SliderWidget(0.2, 0.8, 0.02)) revealDuration: number = 0.65
  @ui.group_end

  private board: StepSweeperBoardManager | null = null
  private visuals: CellVisual[] = []
  private boardContentRoot: SceneObject | null = null
  private playerHighlight: SceneObject | null = null
  private targetHighlight: SceneObject | null = null
  private effects: StepSweeperBoardEffects | null = null
  private revealAnimations: RevealAnimation[] = []
  private startSequenceStartedAt = -1
  private effectsStarted = false
  private clueCamera: SceneObject | null = null
  private cornerMesh!: RenderMesh
  private coveredCorners!: Material
  private safeCorners!: Material
  private activeCorners!: Material
  private targetCorners!: Material
  private quietGrid!: Material
  private safeFloor: RenderMeshVisual | null = null
  private tapBindings: {interactable: Interactable, cell: StepSweeperCellData}[] = []
  public readonly onCellTapped = new Event<StepSweeperCellData>()

  setClueCamera(camera: SceneObject): void {
    this.clueCamera = camera
    this.effects?.setViewer(camera)
  }

  build(board: StepSweeperBoardManager): void {
    this.clear()
    this.board = board
    this.boardContentRoot = global.scene.createSceneObject("BoardContent")
    this.boardContentRoot.setParent(this.sceneObject)
    if (!this.effects) this.effects = new StepSweeperBoardEffects(this.sceneObject, this.tileMesh, this.boundaryMaterial)
    if (this.clueCamera) this.effects.setViewer(this.clueCamera)
    this.cornerMesh = this.floorMesh(this.cornerRects(board.cellSizeCm * 0.46, board.cellSizeCm * 0.46, 5, 0.48))
    this.coveredCorners = this.floorMaterial(this.floorMarkColor)
    this.safeCorners = this.floorMaterial(new vec4(0.3, 0.85, 0.94, 0.32))
    this.activeCorners = this.floorMaterial(new vec4(0.83, 1, 1, 0.9))
    this.targetCorners = this.floorMaterial(new vec4(0.68, 0.95, 1, 0.7))
    this.quietGrid = this.floorMaterial(new vec4(0.2, 0.7, 0.85, this.gridOpacity))
    // per-tile factory — Hard Rule 3 grid-cell carve-out (N = 25–49)
    for (const cell of board.cells) this.visuals.push(this.createCell(cell))
    for (const binding of this.tapBindings) binding.interactable.onTriggerStart.add(() => this.onCellTapped.invoke(binding.cell))
    this.createFieldLines(board)
    new StepSweeperArena(this.boardContentRoot, this.boundaryMaterial, board.columns * board.cellSizeCm, board.rows * board.cellSizeCm, board.cellSizeCm)
    const safeFloor = global.scene.createSceneObject("SafeFloorInsets")
    safeFloor.setParent(this.boardContentRoot)
    safeFloor.getTransform().setLocalPosition(new vec3(0, 0.19, 0))
    this.safeFloor = safeFloor.createComponent("Component.RenderMeshVisual") as RenderMeshVisual
    this.safeFloor.renderOrder = -10
    this.safeFloor.mainMaterial = this.floorMaterial(new vec4(0.06, 0.92, 0.64, 0.16))
    safeFloor.enabled = false
    this.playerHighlight = this.createFloorVisual("PlayerCellHighlight", this.boardContentRoot, this.cornerMesh, this.activeCorners, 0.7)
    this.targetHighlight = this.createFloorVisual("TargetCellHighlight", this.boardContentRoot, this.cornerMesh, this.targetCorners, 0.6)
    this.playerHighlight.enabled = false
    this.targetHighlight.enabled = false
    if (!this.effectsStarted) {
      this.effectsStarted = true
      this.createEvent("UpdateEvent").bind(() => this.animate())
      this.createEvent("LateUpdateEvent").bind(() => {
        if (!this.clueCamera) return
        const position = this.clueCamera.getTransform().getWorldPosition()
        for (const visual of this.visuals) visual.clue.faceViewer(position)
      })
    }
    console.log(`[SpecsSweeper] BOARD_CREATED rows=${board.rows} columns=${board.columns} cellSize=${board.cellSizeCm}`)
  }

  reset(board: StepSweeperBoardManager): void {
    this.revealAnimations = []
    this.startSequenceStartedAt = -1
    this.effects?.clearBurst()
    for (const cell of board.cells) this.refreshCell(cell, false)
    this.setTarget(null)
    this.setPlayer(null)
  }

  playStartSequence(): void { this.startSequenceStartedAt = getTime() }

  refreshCell(cell: StepSweeperCellData, animate: boolean): void {
    if (!this.board) return
    const visual = this.visuals[this.board.index(cell)]
    if (!visual) return
    visual.wash.enabled = !cell.isRevealed
    visual.washMaterial.mainPass.baseColor = new vec4(0.2, 0.72, 0.86, this.floorWashOpacity)
    visual.cornerVisual.mainMaterial = cell.isRevealed ? this.safeCorners : this.coveredCorners
    visual.corners.getTransform().setLocalScale(vec3.one())
    visual.revealCorners.enabled = false
    visual.scan.enabled = false
    if (cell.hasMine && cell.isRevealed && !visual.mine) visual.mine = this.effects!.createMine(visual.root)
    if (visual.mine) visual.mine.enabled = cell.hasMine && cell.isRevealed
    const showFlag = cell.isFlagged && !cell.isRevealed
    if (showFlag && !visual.flag) visual.flag = this.effects!.createFlag(visual.root, `RedFlag_${cell.row}_${cell.column}`)
    if (visual.flag) visual.flag.set(showFlag, animate)
    visual.clue.enabled = cell.isRevealed && !cell.hasMine
    visual.clue.root.getTransform().setLocalScale(vec3.one())
    if (visual.clue.enabled) visual.clue.setValue(cell.adjacentMineCount, this.boundaryMaterial)
    visual.clue.setRevealProgress(1)
    this.revealAnimations = this.revealAnimations.filter(item => item.visual !== visual)
    // Other mines get quiet floor pins; the struck mine alone owns a burst.
    if (animate && cell.isRevealed && !cell.hasMine) {
      visual.wash.enabled = true
      visual.revealCorners.enabled = true
      visual.clue.setRevealProgress(0)
      this.revealAnimations.push({visual, startedAt: getTime()})
    }
    this.refreshSafeFloor()
  }

  private refreshSafeFloor(): void {
    if (!this.board || !this.safeFloor) return
    const rectangles: FloorRect[] = []
    const half = this.board.cellSizeCm / 2 - 2
    for (let i = 0; i < this.visuals.length; i++) {
      if (!this.visuals[i].clue.enabled || this.board.cells[i].adjacentMineCount !== 0) continue
      const position = this.board.boardLocalPosition(this.board.cells[i], 0)
      rectangles.push([position.x - half, position.z - half, position.x + half, position.z + half])
    }
    this.safeFloor.getSceneObject().enabled = rectangles.length > 0
    if (rectangles.length > 0) this.safeFloor.mesh = this.floorMesh(rectangles)
  }

  revealAllMines(board: StepSweeperBoardManager): void {
    for (const cell of board.cells) if (cell.hasMine) {
      cell.isRevealed = true
      this.refreshCell(cell, false)
    }
  }

  setDebugMines(board: StepSweeperBoardManager, visible: boolean): void {
    for (const cell of board.cells) {
      if (!cell.hasMine || cell.isRevealed) continue
      const visual = this.visuals[board.index(cell)]
      if (visible && !visual.mine) visual.mine = this.effects!.createMine(visual.root)
      if (visual.mine) visual.mine.enabled = visible
    }
  }

  setPlayer(cell: StepSweeperCellData | null): void {
    if (!this.board || !this.playerHighlight) return
    this.playerHighlight.enabled = cell !== null
    if (cell) this.playerHighlight.getTransform().setLocalPosition(this.board.boardLocalPosition(cell, 0.7))
  }

  setTarget(cell: StepSweeperCellData | null): void {
    if (!this.board || !this.targetHighlight) return
    this.targetHighlight.enabled = cell !== null && !cell.isRevealed
    if (cell) this.targetHighlight.getTransform().setLocalPosition(this.board.boardLocalPosition(cell, 0.6))
  }

  playMineBurst(cell: StepSweeperCellData): void {
    if (!this.board) return
    this.effects!.playBurst(this.board.boardLocalPosition(cell, 0.8), this.board.cellSizeCm, this.visuals[this.board.index(cell)].mine)
  }

  playVictory(): void {
    if (this.board) this.effects?.playVictory(this.board.columns * this.board.cellSizeCm, this.board.rows * this.board.cellSizeCm)
  }

  private createCell(cell: StepSweeperCellData): CellVisual {
    const board = this.board!
    const root = global.scene.createSceneObject(`Cell_${cell.row}_${cell.column}`)
    root.setParent(this.boardContentRoot!)
    root.getTransform().setLocalPosition(board.boardLocalPosition(cell, 0))
    const washMaterial = this.floorMaterial(new vec4(0.2, 0.72, 0.86, this.floorWashOpacity))
    const wash = this.createBox("CoveredFloorWash", root, new vec3(0, 0.16, 0), new vec3(board.cellSizeCm - 2, 0.03, board.cellSizeCm - 2), washMaterial)
    const corners = this.createFloorVisual("CellFloorCorners", root, this.cornerMesh, this.coveredCorners, 0.4)
    const cornerVisual = corners.getComponent("Component.RenderMeshVisual") as RenderMeshVisual
    const revealCornerMaterial = this.floorMaterial(new vec4(1, 0.94, 0.8, 0))
    const revealCorners = this.createFloorVisual("CellRevealCorners", root, this.cornerMesh, revealCornerMaterial, 0.55)
    revealCorners.enabled = false
    const scan = this.createBox("CellRevealScan", root, new vec3(0, 0.8, 0), new vec3(board.cellSizeCm * 0.86, 0.06, 0.45), this.activeCorners)
    scan.enabled = false
    const collider = root.createComponent("Physics.ColliderComponent") as ColliderComponent
    const shape = Shape.createBoxShape()
    shape.size = new vec3(board.cellSizeCm - 5, 7, board.cellSizeCm - 5)
    collider.shape = shape
    collider.debugDrawEnabled = false
    const interactable = root.createComponent(Interactable.getTypeName()) as Interactable
    interactable.targetingMode = 3
    this.tapBindings.push({interactable, cell})
    const clue = new StepSweeperSpatialClue(root, this.tileMesh, this.boundaryMaterial, board.cellSizeCm)
    return {root, wash, washMaterial, corners, cornerVisual, revealCorners, revealCornerMaterial, scan, clue, mine: null, flag: null}
  }

  private createFieldLines(board: StepSweeperBoardManager): void {
    const width = board.columns * board.cellSizeCm, depth = board.rows * board.cellSizeCm
    const rectangles: FloorRect[] = []
    for (let c = 1; c < board.columns; c++) {
      const x = -width / 2 + c * board.cellSizeCm
      rectangles.push([x - 0.3, -depth / 2, x + 0.3, depth / 2])
    }
    for (let r = 1; r < board.rows; r++) {
      const z = -depth / 2 + r * board.cellSizeCm
      rectangles.push([-width / 2, z - 0.3, width / 2, z + 0.3])
    }
    this.createFloorVisual("FieldGrid", this.boardContentRoot!, this.floorMesh(rectangles), this.quietGrid, 0.23)
    this.createFloorVisual("FieldBoundaryCorners", this.boardContentRoot!, this.floorMesh(this.cornerRects(width / 2, depth / 2, 12, 0.65)), this.coveredCorners, 0.3)
  }

  private animate(): void {
    if (!this.board) return
    const now = getTime()
    if (this.targetHighlight?.enabled) {
      const scale = 0.98 + Math.sin(now * 3) * 0.01
      this.targetHighlight.getTransform().setLocalScale(new vec3(scale, 1, scale))
    }
    if (this.startSequenceStartedAt >= 0) {
      let complete = true
      for (let i = 0; i < this.visuals.length; i++) {
        const visual = this.visuals[i]
        if (visual.clue.enabled) continue
        const delay = (Math.floor(i / this.board.columns) + i % this.board.columns) * 0.025
        const progress = Math.max(0, Math.min(1, (now - this.startSequenceStartedAt - delay) / 0.24))
        if (progress < 1) complete = false
        visual.corners.getTransform().setLocalScale(new vec3(0.9 + progress * 0.1, 1, 0.9 + progress * 0.1))
      }
      if (complete) this.startSequenceStartedAt = -1
    }
    for (let i = this.revealAnimations.length - 1; i >= 0; i--) {
      const {visual, startedAt} = this.revealAnimations[i]
      const progress = Math.min(1, (now - startedAt) / this.revealDuration)
      const pulse = Math.min(1, progress / 0.1) * (1 - Math.max(0, Math.min(1, (progress - 0.24) / 0.46)))
      visual.revealCornerMaterial.mainPass.baseColor = new vec4(1, 0.94, 0.8, pulse * 0.95)
      const scanProgress = Math.max(0, Math.min(1, (progress - 0.18) / 0.36))
      visual.scan.enabled = progress >= 0.18 && progress < 0.54
      visual.scan.getTransform().setLocalPosition(new vec3(0, 0.8, (0.5 - scanProgress) * this.board.cellSizeCm * 0.9))
      visual.washMaterial.mainPass.baseColor = new vec4(0.2, 0.72, 0.86, Math.sin(progress * Math.PI) * 0.065)
      visual.clue.setRevealProgress(Math.max(0, Math.min(1, (progress - 0.37) / 0.43)))
      if (progress >= 1) {
        visual.scan.enabled = false
        visual.wash.enabled = false
        visual.revealCorners.enabled = false
        visual.cornerVisual.mainMaterial = this.safeCorners
        visual.clue.setRevealProgress(1)
        this.revealAnimations.splice(i, 1)
      }
    }
    this.effects?.update(now)
  }

  private floorMaterial(color: vec4): Material {
    const material = this.boundaryMaterial.clone()
    material.mainPass.baseColor = color
    material.mainPass.blendMode = BlendMode.Normal
    material.mainPass.depthTest = true
    material.mainPass.depthWrite = false
    return material
  }

  private cornerRects(x: number, z: number, length: number, thickness: number): FloorRect[] {
    const rectangles: FloorRect[] = []
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      const x0 = sx < 0 ? -x : x - length, z0 = sz < 0 ? -z : z - length
      rectangles.push([x0, sz * z - thickness / 2, x0 + length, sz * z + thickness / 2])
      rectangles.push([sx * x - thickness / 2, z0, sx * x + thickness / 2, z0 + length])
    }
    return rectangles
  }

  private floorMesh(rectangles: FloorRect[]): RenderMesh {
    const builder = new MeshBuilder([{name: "position", components: 3}, {name: "normal", components: 3}, {name: "texture0", components: 2}])
    builder.topology = MeshTopology.Triangles
    builder.indexType = MeshIndexType.UInt16
    for (const [x0, z0, x1, z1] of rectangles) {
      const index = builder.getVerticesCount()
      builder.appendVerticesInterleaved([x0, 0, z0, 0, 1, 0, 0, 0, x0, 0, z1, 0, 1, 0, 0, 1,
        x1, 0, z0, 0, 1, 0, 1, 0, x1, 0, z1, 0, 1, 0, 1, 1])
      builder.appendIndices([index, index + 1, index + 2, index + 2, index + 1, index + 3])
    }
    builder.updateMesh()
    return builder.getMesh()
  }

  private createFloorVisual(name: string, parent: SceneObject, mesh: RenderMesh, material: Material, y: number): SceneObject {
    const object = global.scene.createSceneObject(name)
    object.setParent(parent)
    object.getTransform().setLocalPosition(new vec3(0, y, 0))
    const visual = object.createComponent("Component.RenderMeshVisual") as RenderMeshVisual
    visual.mesh = mesh
    visual.mainMaterial = material
    return object
  }

  private createBox(name: string, parent: SceneObject, position: vec3, scale: vec3, material: Material): SceneObject {
    const object = this.createFloorVisual(name, parent, this.tileMesh, material, position.y)
    object.getTransform().setLocalPosition(position)
    object.getTransform().setLocalScale(scale)
    return object
  }

  private clear(): void {
    this.effects?.clearBoard()
    this.startSequenceStartedAt = -1
    this.revealAnimations = []
    if (this.boardContentRoot) this.boardContentRoot.destroy()
    this.boardContentRoot = null
    this.safeFloor = null
    this.visuals = []
    this.tapBindings = []
  }
}
