import {StepSweeperBoardManager} from "./StepSweeperBoardManager"
import {StepSweeperCellData} from "./StepSweeperCellData"
import {Interactable} from "SpectaclesInteractionKit.lspkg/Components/Interaction/Interactable/Interactable"
import Event from "SpectaclesInteractionKit.lspkg/Utils/Event"

const RED_FLAG_PREFAB = requireAsset("../Generative 3D Package.lspkg/06a9944f-f90c-7268-8000-a9f4115d4e44-model.glb") as ObjectPrefab

type CellVisual = {
  root: SceneObject
  base: RenderMeshVisual
  deck: SceneObject
  deckVisual: RenderMeshVisual
  clueObject: SceneObject
  clue: Text
  mine: SceneObject | null
  flag: SceneObject | null
}

type RevealAnimation = {visual: CellVisual, startedAt: number}
type PulseVisual = {object: SceneObject, phase: number}
type ShockwaveAnimation = {object: SceneObject, startedAt: number, origin: vec3, direction: vec3}
type ExplosionParticle = {
  object: SceneObject
  startedAt: number
  lifetime: number
  origin: vec3
  velocity: vec3
  baseScale: vec3
  spin: number
}
type ExplosionFlash = {object: SceneObject, startedAt: number, lifetime: number, baseScale: number}

/**
 * Specs Sweeper board presentation — high-cardinality in-world board presentation.
 * Owns tile meshes, clue text, generated flag props, highlights, boundary, and small effects.
 */
@component
export class StepSweeperCellViewUI extends BaseScriptComponent {
  @ui.label('<span style="color: #22D3EE;">Specs Sweeper board presentation</span>')
  @ui.separator
  @ui.group_start("References")
  @input @hint("Shared unit box mesh used by every tile and marker") tileMesh!: RenderMesh
  @input @hint("Nearly transparent unrevealed tile material") unrevealedMaterial!: Material
  @input @hint("Cyan safe reveal material") revealedMaterial!: Material
  @input @hint("Orange/red mine material") mineMaterial!: Material
  @input @hint("Orange holographic flag material") flagMaterial!: Material
  @input @hint("Cyan current-player cell highlight") playerHighlightMaterial!: Material
  @input @hint("Yellow target cell highlight") targetHighlightMaterial!: Material
  @input @hint("Cyan board boundary material") boundaryMaterial!: Material
  @input @hint("Asset Library hologram material used by thin frame rails and beacons") hologramMaterial!: Material
  @input @hint("Asset Library scan material used by the targeted cell") scanMaterial!: Material
  @ui.group_end

  private board: StepSweeperBoardManager | null = null
  private visuals: CellVisual[] = []
  private boardContentRoot: SceneObject | null = null
  private playerHighlight: SceneObject | null = null
  private targetHighlight: SceneObject | null = null
  private simulatedPlayer: SceneObject | null = null
  private celebration: ShockwaveAnimation[] = []
  private explosionParticles: ExplosionParticle[] = []
  private explosionPool: SceneObject[] = []
  private explosionFlashes: ExplosionFlash[] = []
  private explosionSparkMaterial: Material | null = null
  private explosionCoreMaterial: Material | null = null
  private revealAnimations: RevealAnimation[] = []
  private frameBeacons: PulseVisual[] = []
  private startSequenceStartedAt = -1
  private effectsStarted = false
  private tapBindings: {interactable: Interactable, cell: StepSweeperCellData}[] = []
  public readonly onCellTapped = new Event<StepSweeperCellData>()

  build(board: StepSweeperBoardManager): void {
    this.clear()
    this.board = board
    this.boardContentRoot = global.scene.createSceneObject("BoardContent")
    this.boardContentRoot.setParent(this.sceneObject)
    this.prepareExplosionMaterials()
    // per-tile factory — Hard Rule 3 grid-cell carve-out (N = 25–49)
    for (const cell of board.cells) this.visuals.push(this.createCell(cell))
    // The cells and their Interactable components are created during the
    // parent's OnStart phase, so their startup lifecycle has completed inline.
    for (const binding of this.tapBindings) {
      binding.interactable.onTriggerStart.add(() => this.onCellTapped.invoke(binding.cell))
    }
    this.createGridLines(board)
    this.createBoundary(board)
    this.playerHighlight = this.createBox("PlayerCellHighlight", this.boardContentRoot, vec3.zero(), new vec3(board.cellSizeCm * 0.88, 0.24, board.cellSizeCm * 0.88), this.playerHighlightMaterial)
    this.targetHighlight = this.createBox("TargetCellHighlight", this.boardContentRoot, vec3.zero(), new vec3(board.cellSizeCm * 0.72, 0.32, board.cellSizeCm * 0.72), this.scanMaterial)
    this.simulatedPlayer = this.createBox("SimulatedPlayer", this.boardContentRoot, vec3.zero(), new vec3(8, 3, 8), this.playerHighlightMaterial)
    this.playerHighlight.enabled = false
    this.targetHighlight.enabled = false
    if (!this.effectsStarted) {
      this.effectsStarted = true
      this.createEvent("UpdateEvent").bind(() => this.animateHighlights())
    }
    console.log(`[SpecsSweeper] BOARD_CREATED rows=${board.rows} columns=${board.columns} cellSize=${board.cellSizeCm}`)
  }

  reset(board: StepSweeperBoardManager): void {
    for (const cell of board.cells) this.refreshCell(cell, false)
    this.setTarget(null)
    this.setPlayer(null)
    this.clearCelebration()
  }

  playStartSequence(): void {
    this.startSequenceStartedAt = getTime()
    for (const visual of this.visuals) {
      visual.deck.getTransform().setLocalPosition(new vec3(0, 0.65, 0))
      visual.deck.getTransform().setLocalScale(new vec3(this.board!.cellSizeCm - 10, 0.45, this.board!.cellSizeCm - 10))
    }
  }

  refreshCell(cell: StepSweeperCellData, animate: boolean): void {
    const visual = this.visuals[this.index(cell)]
    if (!visual) return
    const tileMaterial = cell.isRevealed
      ? (cell.hasMine ? this.mineMaterial : this.revealedMaterial)
      : this.unrevealedMaterial
    visual.base.mainMaterial = tileMaterial
    visual.deckVisual.mainMaterial = tileMaterial
    if (cell.hasMine && cell.isRevealed && !visual.mine) visual.mine = this.createMine(visual.root)
    if (visual.mine) visual.mine.enabled = cell.hasMine && cell.isRevealed
    if (cell.isFlagged && !cell.isRevealed) {
      if (!visual.flag) visual.flag = this.createFlag(visual.root, cell)
      visual.flag.enabled = true
    } else if (visual.flag) {
      visual.flag.enabled = false
    }
    // In room-scale play the first safe step is intentionally surrounded by a
    // mine-free zone, so it is usually a zero. Keep zero clues visible to give
    // immediate feedback that walking onto the tile actually revealed it.
    visual.clue.enabled = cell.isRevealed && !cell.hasMine
    if (visual.clue.enabled) {
      visual.clue.text = String(cell.adjacentMineCount)
      visual.clue.textFill.color = cell.adjacentMineCount === 0
        ? new vec4(0.25, 1, 0.7, 1)
        : cell.adjacentMineCount === 1
          ? new vec4(0.2, 0.85, 1, 1)
          : cell.adjacentMineCount === 2
            ? new vec4(1, 0.85, 0.15, 1)
            : new vec4(1, 0.3, 0.1, 1)
    }
    if (animate && cell.isRevealed) {
      visual.deck.getTransform().setLocalPosition(new vec3(0, 6.4, 0))
      visual.deck.getTransform().setLocalScale(new vec3(this.board!.cellSizeCm - 5, 2.1, this.board!.cellSizeCm - 5))
      visual.clueObject.getTransform().setLocalScale(new vec3(0.58, 0.58, 0.58))
      this.revealAnimations = this.revealAnimations.filter(item => item.visual !== visual)
      this.revealAnimations.push({visual, startedAt: getTime()})
    } else if (!cell.isRevealed) {
      this.restoreClosedTile(visual)
    }
  }

  revealAllMines(board: StepSweeperBoardManager): void {
    for (const cell of board.cells) {
      if (cell.hasMine) {
        cell.isRevealed = true
        this.refreshCell(cell, true)
      }
    }
  }

  setDebugMines(board: StepSweeperBoardManager, visible: boolean): void {
    for (const cell of board.cells) {
      if (!cell.hasMine || cell.isRevealed) continue
      const visual = this.visuals[this.index(cell)]
      if (!visual) continue
      if (visible && !visual.mine) visual.mine = this.createMine(visual.root)
      if (visual.mine) visual.mine.enabled = visible
    }
  }

  setPlayer(cell: StepSweeperCellData | null): void {
    if (!this.board || !this.playerHighlight || !this.simulatedPlayer) return
    const enabled = cell !== null
    this.playerHighlight.enabled = enabled
    this.simulatedPlayer.enabled = enabled
    if (cell) {
      const pos = this.board.boardLocalPosition(cell, 0.9)
      this.playerHighlight.getTransform().setLocalPosition(pos)
      this.simulatedPlayer.getTransform().setLocalPosition(pos.add(new vec3(0, 3, 0)))
    }
  }

  setTarget(cell: StepSweeperCellData | null): void {
    if (!this.board || !this.targetHighlight) return
    this.targetHighlight.enabled = cell !== null && !cell.isRevealed
    if (cell) this.targetHighlight.getTransform().setLocalPosition(this.board.boardLocalPosition(cell, 1.35))
  }

  playMineBurst(cell: StepSweeperCellData): void {
    if (!this.board) return
    const center = this.board.boardLocalPosition(cell, 10)
    this.createShockwave(center, this.mineMaterial)
    this.createExplosionFlash(center)
    this.createExplosionParticles(center)
  }

  playVictory(): void {
    // End-state feedback is handled by the anchored UI. Avoid decorative
    // geometry so the board stays clear and the presentation remains cheap.
  }

  private createCell(cell: StepSweeperCellData): CellVisual {
    if (!this.board) throw new Error("Board not assigned")
    const root = global.scene.createSceneObject(`Cell_${cell.row}_${cell.column}`)
    root.setParent(this.boardContentRoot as SceneObject)
    root.getTransform().setLocalPosition(this.board.boardLocalPosition(cell, 0))

    const baseObject = this.createBox("ArmoredBase", root, new vec3(0, 1.0, 0), new vec3(this.board.cellSizeCm - 2, 2.0, this.board.cellSizeCm - 2), this.unrevealedMaterial)
    const base = baseObject.getComponent("Component.RenderMeshVisual") as RenderMeshVisual
    const deck = this.createBox("InsetDeck", root, new vec3(0, 3.1, 0), new vec3(this.board.cellSizeCm - 6, 2.2, this.board.cellSizeCm - 6), this.unrevealedMaterial)
    const deckVisual = deck.getComponent("Component.RenderMeshVisual") as RenderMeshVisual

    const collider = root.createComponent("Physics.ColliderComponent") as ColliderComponent
    const shape = Shape.createBoxShape()
    shape.size = new vec3(this.board.cellSizeCm - 5, 7, this.board.cellSizeCm - 5)
    collider.shape = shape
    collider.debugDrawEnabled = false
    const interactable = root.createComponent(Interactable.getTypeName()) as Interactable
    interactable.targetingMode = 3
    this.tapBindings.push({interactable, cell})

    const clueObject = global.scene.createSceneObject("Clue")
    clueObject.setParent(root)
    clueObject.getTransform().setLocalPosition(new vec3(0, 4.2, 0))
    // Lay the text on the floor and turn its top edge toward the board's entry
    // side, so clues read upright as the player walks onto the grid.
    const floorRotation = quat.angleAxis(-Math.PI / 2, vec3.right())
    const uprightFromEntry = quat.angleAxis(Math.PI, vec3.forward())
    clueObject.getTransform().setLocalRotation(floorRotation.multiply(uprightFromEntry))
    const clue = clueObject.createComponent("Component.Text") as Text
    clue.text = ""
    clue.size = 780
    clue.weight = 800
    clue.depthTest = false
    clue.renderOrder = 120
    clue.horizontalAlignment = HorizontalAlignment.Center
    clue.verticalAlignment = VerticalAlignment.Center
    clue.layoutRect = Rect.create(-21, 21, -21, 21)
    clue.outlineSettings.enabled = true
    clue.outlineSettings.size = 0.32
    clue.outlineSettings.fill.color = new vec4(0.005, 0.025, 0.04, 1)
    clue.backgroundSettings.enabled = true
    clue.backgroundSettings.fill.color = new vec4(0.005, 0.025, 0.04, 0.82)
    clue.backgroundSettings.margins = Rect.create(1.8, 1.8, 1.8, 1.8)
    clue.backgroundSettings.cornerRadius = 0.22
    clue.enabled = false

    return {root, base, deck, deckVisual, clueObject, clue, mine: null, flag: null}
  }

  private createFlag(parent: SceneObject, cell: StepSweeperCellData): SceneObject {
    const flag = RED_FLAG_PREFAB.instantiate(parent)
    flag.name = `RedFlag_${cell.row}_${cell.column}`
    flag.getTransform().setLocalPosition(new vec3(0, 2.2, 0))
    flag.getTransform().setLocalRotation(quat.angleAxis(-Math.PI * 0.5, vec3.up()))
    flag.getTransform().setLocalScale(new vec3(26, 26, 26))
    return flag
  }

  private createMine(parent: SceneObject): SceneObject {
    if (!this.board) throw new Error("Board not assigned")
    const mine = global.scene.createSceneObject("Mine")
    mine.setParent(parent)
    mine.getTransform().setLocalPosition(new vec3(0, 6, 0))
    this.createBox("MineCore", mine, vec3.zero(), new vec3(11, 7, 11), this.mineMaterial)
    this.createBox("MineRailX", mine, vec3.zero(), new vec3(22, 2.2, 3), this.mineMaterial)
    this.createBox("MineRailZ", mine, vec3.zero(), new vec3(3, 2.2, 22), this.mineMaterial)
    this.createBox("MineFuse", mine, new vec3(0, 6, 0), new vec3(3, 9, 3), this.flagMaterial)
    for (let i = 0; i < 4; i++) {
      const angle = i * Math.PI * 0.5
      const tip = this.createBox(`MineTip-${i}`, mine, new vec3(Math.cos(angle) * 11, 0, Math.sin(angle) * 11), new vec3(4, 4, 4), this.mineMaterial)
      tip.getTransform().setLocalRotation(quat.angleAxis(Math.PI * 0.25, vec3.up()))
    }
    return mine
  }

  private createShockwave(center: vec3, material: Material): void {
    for (let i = 0; i < 4; i++) {
      const angle = i * Math.PI * 0.5
      const bar = this.createBox(`Shockwave-${i}`, this.sceneObject, center, new vec3(3, 0.3, 22), material)
      bar.getTransform().setLocalRotation(quat.angleAxis(angle, vec3.up()))
      this.celebration.push({
        object: bar,
        startedAt: getTime(),
        origin: center,
        direction: new vec3(Math.cos(angle), 0, Math.sin(angle)),
      })
    }
  }

  private createExplosionParticles(center: vec3): void {
    const particleCount = 24
    const now = getTime()
    for (let i = 0; i < particleCount; i++) {
      const particle = this.acquireExplosionParticle(i)
      const angle = i * 2.399963229728653
      const spread = 58 + this.hash(i, 1) * 62
      const upward = 72 + this.hash(i, 2) * 68
      const isDebris = i % 4 === 0
      const width = isDebris ? 8 : 4 + this.hash(i, 3) * 2.5
      const height = isDebris ? 8 : 14 + this.hash(i, 4) * 10
      const scale = new vec3(width, height, width)
      const visual = particle.getComponent("Component.RenderMeshVisual") as RenderMeshVisual
      visual.mainMaterial = isDebris
        ? (this.explosionCoreMaterial as Material)
        : (this.explosionSparkMaterial as Material)
      visual.mainMaterial.mainPass.depthTest = false
      visual.mainMaterial.mainPass.depthWrite = false
      visual.renderOrder = 300
      particle.enabled = true
      particle.getTransform().setLocalPosition(center)
      particle.getTransform().setLocalScale(scale)
      particle.getTransform().setLocalRotation(quat.angleAxis(angle, vec3.up()))
      this.explosionParticles.push({
        object: particle,
        startedAt: now,
        lifetime: 1.15 + this.hash(i, 5) * 0.45,
        origin: center,
        velocity: new vec3(Math.cos(angle) * spread, upward, Math.sin(angle) * spread),
        baseScale: scale,
        spin: (this.hash(i, 6) * 2 - 1) * 11,
      })
    }
  }

  private createExplosionFlash(center: vec3): void {
    const flash = this.createBox("ExplosionFlash", this.sceneObject, center, new vec3(12, 12, 12), this.explosionCoreMaterial as Material)
    const visual = flash.getComponent("Component.RenderMeshVisual") as RenderMeshVisual
    visual.mainMaterial.mainPass.depthTest = false
    visual.mainMaterial.mainPass.depthWrite = false
    visual.renderOrder = 299
    this.explosionFlashes.push({object: flash, startedAt: getTime(), lifetime: 0.7, baseScale: 12})
  }

  private acquireExplosionParticle(index: number): SceneObject {
    for (const particle of this.explosionPool) {
      if (!particle.enabled) return particle
    }
    const particle = this.createBox(`ExplosionParticle-${index}`, this.sceneObject, vec3.zero(), vec3.one(), this.explosionSparkMaterial as Material)
    particle.enabled = false
    this.explosionPool.push(particle)
    return particle
  }

  private hash(index: number, salt: number): number {
    const value = Math.sin(index * 12.9898 + salt * 78.233) * 43758.5453
    return value - Math.floor(value)
  }

  private prepareExplosionMaterials(): void {
    if (!this.explosionSparkMaterial) {
      this.explosionSparkMaterial = this.flagMaterial.clone()
      this.explosionSparkMaterial.mainPass.depthTest = false
      this.explosionSparkMaterial.mainPass.depthWrite = false
    }
    if (!this.explosionCoreMaterial) {
      this.explosionCoreMaterial = this.hologramMaterial.clone()
      this.explosionCoreMaterial.mainPass.depthTest = false
      this.explosionCoreMaterial.mainPass.depthWrite = false
    }
  }

  private createBoundary(board: StepSweeperBoardManager): void {
    const root = this.boardContentRoot as SceneObject
    const width = board.columns * board.cellSizeCm
    const depth = board.rows * board.cellSizeCm
    this.createBox("BoundaryNorth", root, new vec3(0, 1, depth * 0.5 + 3), new vec3(width + 12, 2, 5), this.boundaryMaterial)
    this.createBox("BoundarySouth", root, new vec3(0, 1, -depth * 0.5 - 3), new vec3(width + 12, 2, 5), this.boundaryMaterial)
    this.createBox("BoundaryWest", root, new vec3(-width * 0.5 - 3, 1, 0), new vec3(5, 2, depth + 12), this.boundaryMaterial)
    this.createBox("BoundaryEast", root, new vec3(width * 0.5 + 3, 1, 0), new vec3(5, 2, depth + 12), this.boundaryMaterial)
    this.createFrameHardware(width, depth)
  }

  private createFrameHardware(width: number, depth: number): void {
    const root = this.boardContentRoot as SceneObject
    const cornerX = width * 0.5 - 5
    const cornerZ = depth * 0.5 - 5
    for (let xIndex = -1; xIndex <= 1; xIndex += 2) {
      for (let zIndex = -1; zIndex <= 1; zIndex += 2) {
        const x = cornerX * xIndex
        const z = cornerZ * zIndex
        const prefix = `FramePost-${xIndex}-${zIndex}`
        this.createBox(`${prefix}-Foot`, root, new vec3(x, 1.8, z), new vec3(20, 3.6, 20), this.boundaryMaterial)
        this.createBox(`${prefix}-Shaft`, root, new vec3(x, 12.5, z), new vec3(8, 21.5, 8), this.boundaryMaterial)
        this.createBox(`${prefix}-LightStrip`, root, new vec3(x, 13, z), new vec3(9, 12, 9), this.hologramMaterial)
        this.createBox(`${prefix}-Collar`, root, new vec3(x, 24, z), new vec3(14, 2.6, 14), this.boundaryMaterial)
        const beacon = this.createBox(`${prefix}-Beacon`, root, new vec3(x, 27, z), new vec3(9, 3.4, 9), this.hologramMaterial)
        this.frameBeacons.push({object: beacon, phase: this.frameBeacons.length * Math.PI * 0.5})
      }
    }

    // Layered outer rails give the board a readable physical silhouette from
    // shallow viewing angles without adding heavy imported geometry.
    this.createBox("FrameRailNorth", root, new vec3(0, 5.8, cornerZ), new vec3(width - 8, 3, 5), this.hologramMaterial)
    this.createBox("FrameRailSouth", root, new vec3(0, 5.8, -cornerZ), new vec3(width - 8, 3, 5), this.hologramMaterial)
    this.createBox("FrameRailWest", root, new vec3(-cornerX, 5.8, 0), new vec3(5, 3, depth - 8), this.hologramMaterial)
    this.createBox("FrameRailEast", root, new vec3(cornerX, 5.8, 0), new vec3(5, 3, depth - 8), this.hologramMaterial)
  }

  private createGridLines(board: StepSweeperBoardManager): void {
    const root = this.boardContentRoot as SceneObject
    const width = board.columns * board.cellSizeCm
    const depth = board.rows * board.cellSizeCm
    for (let column = 1; column < board.columns; column++) {
      const x = -width * 0.5 + column * board.cellSizeCm
      this.createBox(`GridColumn-${column}`, root, new vec3(x, 0.72, 0), new vec3(0.72, 0.85, depth), this.boundaryMaterial)
    }
    for (let row = 1; row < board.rows; row++) {
      const z = -depth * 0.5 + row * board.cellSizeCm
      this.createBox(`GridRow-${row}`, root, new vec3(0, 0.72, z), new vec3(width, 0.85, 0.72), this.boundaryMaterial)
    }
  }

  private createBox(name: string, parent: SceneObject, position: vec3, scale: vec3, material: Material): SceneObject {
    const object = global.scene.createSceneObject(name)
    object.setParent(parent)
    object.getTransform().setLocalPosition(position)
    object.getTransform().setLocalScale(scale)
    const visual = object.createComponent("Component.RenderMeshVisual") as RenderMeshVisual
    visual.mesh = this.tileMesh
    visual.mainMaterial = material
    return object
  }

  private animateHighlights(): void {
    if (!this.board) return
    const now = getTime()
    if (this.targetHighlight?.enabled) {
      const targetSize = this.board.cellSizeCm * (0.72 + Math.sin(now * 6) * 0.012)
      this.targetHighlight.getTransform().setLocalScale(new vec3(targetSize, 0.32, targetSize))
    }
    if (this.playerHighlight?.enabled) {
      const playerSize = this.board.cellSizeCm * (0.86 + Math.sin(now * 4) * 0.008)
      this.playerHighlight.getTransform().setLocalScale(new vec3(playerSize, 0.26, playerSize))
    }
    if (this.simulatedPlayer?.enabled) {
      const position = this.simulatedPlayer.getTransform().getLocalPosition()
      this.simulatedPlayer.getTransform().setLocalPosition(new vec3(position.x, 4, position.z))
    }
    for (const pulse of this.frameBeacons) {
      const glow = 1 + Math.sin(now * 2.4 + pulse.phase) * 0.08
      pulse.object.getTransform().setLocalScale(new vec3(9 * glow, 3.4 + (glow - 1) * 4, 9 * glow))
    }
    this.animateStartSequence(now)
    this.animateReveals()
    this.animateShockwaves(now)
    this.animateExplosionFlashes(now)
    this.animateExplosionParticles(now)
  }

  private animateStartSequence(now: number): void {
    if (this.startSequenceStartedAt < 0 || !this.board) return
    let complete = true
    for (let i = 0; i < this.visuals.length; i++) {
      const visual = this.visuals[i]
      if (visual.clue.enabled) continue
      const delay = (Math.floor(i / this.board.columns) + (i % this.board.columns)) * 0.035
      const progress = Math.max(0, Math.min(1, (now - this.startSequenceStartedAt - delay) / 0.28))
      if (progress < 1) complete = false
      const eased = 1 - Math.pow(1 - progress, 3)
      const bounce = Math.sin(progress * Math.PI) * (1 - progress)
      const size = this.board.cellSizeCm - 10 + eased * 4 + bounce * 2
      visual.deck.getTransform().setLocalPosition(new vec3(0, 0.65 + eased * 2.45 + bounce * 0.8, 0))
      visual.deck.getTransform().setLocalScale(new vec3(size, 0.45 + eased * 1.75, size))
    }
    if (complete) this.startSequenceStartedAt = -1
  }

  private animateShockwaves(now: number): void {
    for (let i = this.celebration.length - 1; i >= 0; i--) {
      const effect = this.celebration[i]
      const progress = Math.min(1, (now - effect.startedAt) / 0.48)
      const distance = 58 * (1 - Math.pow(1 - progress, 2))
      effect.object.getTransform().setLocalPosition(effect.origin.add(effect.direction.uniformScale(distance)))
      effect.object.getTransform().setLocalScale(new vec3(3 + progress * 5, 0.3, 22 * (1 - progress * 0.72)))
      if (progress >= 1) {
        effect.object.destroy()
        this.celebration.splice(i, 1)
      }
    }
  }

  private animateExplosionParticles(now: number): void {
    for (let i = this.explosionParticles.length - 1; i >= 0; i--) {
      const particle = this.explosionParticles[i]
      const elapsed = now - particle.startedAt
      const progress = Math.min(1, elapsed / particle.lifetime)
      const gravity = -95 * elapsed * elapsed
      particle.object.getTransform().setLocalPosition(new vec3(
        particle.origin.x + particle.velocity.x * elapsed,
        particle.origin.y + particle.velocity.y * elapsed + gravity,
        particle.origin.z + particle.velocity.z * elapsed,
      ))
      const size = Math.max(0.04, 1 - progress * progress)
      particle.object.getTransform().setLocalScale(particle.baseScale.uniformScale(size))
      particle.object.getTransform().setLocalRotation(quat.angleAxis(particle.spin * elapsed, vec3.up()))
      if (progress >= 1) {
        particle.object.enabled = false
        this.explosionParticles.splice(i, 1)
      }
    }
  }

  private animateExplosionFlashes(now: number): void {
    for (let i = this.explosionFlashes.length - 1; i >= 0; i--) {
      const flash = this.explosionFlashes[i]
      const progress = Math.min(1, (now - flash.startedAt) / flash.lifetime)
      const bloom = Math.sin(progress * Math.PI)
      const scale = flash.baseScale + bloom * 42
      flash.object.getTransform().setLocalScale(new vec3(scale, scale * 0.72, scale))
      if (progress >= 1) {
        flash.object.destroy()
        this.explosionFlashes.splice(i, 1)
      }
    }
  }

  private animateReveals(): void {
    const now = getTime()
    for (let i = this.revealAnimations.length - 1; i >= 0; i--) {
      const animation = this.revealAnimations[i]
      const progress = Math.min(1, (now - animation.startedAt) / 0.28)
      const eased = 1 - Math.pow(1 - progress, 3)
      const bounce = Math.sin(progress * Math.PI) * (1 - progress)
      const deckSize = this.board!.cellSizeCm - 6 + bounce * 2.5
      animation.visual.deck.getTransform().setLocalPosition(new vec3(0, 1.55 + (1 - eased) * 4.85, 0))
      animation.visual.deck.getTransform().setLocalScale(new vec3(deckSize, 0.82 + bounce * 0.5, deckSize))
      const clueScale = 0.58 + eased * 0.42 + bounce * 0.16
      animation.visual.clueObject.getTransform().setLocalScale(new vec3(clueScale, clueScale, clueScale))
      if (progress >= 1) this.revealAnimations.splice(i, 1)
    }
  }

  private restoreClosedTile(visual: CellVisual): void {
    if (!this.board) return
    visual.deck.getTransform().setLocalPosition(new vec3(0, 3.1, 0))
    visual.deck.getTransform().setLocalScale(new vec3(this.board.cellSizeCm - 6, 2.2, this.board.cellSizeCm - 6))
    visual.clueObject.getTransform().setLocalScale(vec3.one())
  }

  private clearCelebration(): void {
    for (const particle of this.celebration) particle.object.destroy()
    this.celebration = []
    for (const particle of this.explosionParticles) particle.object.enabled = false
    this.explosionParticles = []
    for (const flash of this.explosionFlashes) flash.object.destroy()
    this.explosionFlashes = []
  }

  private clear(): void {
    this.clearCelebration()
    for (const particle of this.explosionPool) particle.destroy()
    this.explosionPool = []
    this.frameBeacons = []
    this.startSequenceStartedAt = -1
    this.revealAnimations = []
    if (this.boardContentRoot) this.boardContentRoot.destroy()
    this.boardContentRoot = null
    this.visuals = []
    this.tapBindings = []
  }

  private index(cell: StepSweeperCellData): number {
    return this.board ? this.board.index(cell) : -1
  }
}
