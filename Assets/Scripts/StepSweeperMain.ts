import {SIK} from "SpectaclesInteractionKit.lspkg/SIK"
import {StepSweeperAudioController} from "./StepSweeperAudioController"
import {StepSweeperBoardManager} from "./StepSweeperBoardManager"
import {
  resolveStepSweeperCellEntry,
  StepSweeperCellData,
  StepSweeperCellEntryResult,
} from "./StepSweeperCellData"
import {StepSweeperCellViewUI} from "./StepSweeperCellViewUI"
import {StepSweeperFlagInteraction} from "./StepSweeperFlagInteraction"
import {StepSweeperFloorPlacement} from "./StepSweeperFloorPlacement"
import {StepSweeperGameState, StepSweeperPhase} from "./StepSweeperGameState"
import {StepSweeperGameUI} from "./StepSweeperGameUI"
import {StepSweeperPlayerGridTracker} from "./StepSweeperPlayerGridTracker"
import {
  STEP_SWEEPER_DIFFICULTIES,
  StepSweeperDifficulty,
  StepSweeperProgress,
  StepSweeperWinProgress,
} from "./StepSweeperProgress"
import {StepSweeperRevealSystem} from "./StepSweeperRevealSystem"

type QueuedReveal = {cell: StepSweeperCellData, readyAt: number}

/**
 * Specs Sweeper lifecycle and orchestration only.
 * Inputs: authored board/UI/camera refs plus tunable board and emulator settings.
 */
@component
export class StepSweeperMain extends BaseScriptComponent {
  @ui.label('<span style="color: #22D3EE;">Specs Sweeper – room-scale Minesweeper</span>')
  @ui.separator
  @ui.group_start("References")
  @input @hint("Authored world-space board anchor") boardRoot!: SceneObject
  @input @hint("Main tracked camera object") cameraObject!: SceneObject
  @input @hint("Board presentation component") cellView!: StepSweeperCellViewUI
  @input @hint("UIKit intro, HUD, debug, and end-state view") gameUI!: StepSweeperGameUI
  @input @allowUndefined @hint("Optional Asset Library accent played when a round starts") startAccentTrack?: AudioTrackAsset
  @ui.group_end
  @ui.separator
  @ui.group_start("Board Settings")
  @input @hint("Board row count") @widget(new SliderWidget(4, 10, 1)) rows: number = 6
  @input @hint("Board column count") @widget(new SliderWidget(4, 10, 1)) columns: number = 6
  @input @hint("Cell width and depth in centimeters") @widget(new SliderWidget(35, 70, 1)) cellSizeCm: number = 50
  @input @hint("Mine count") @widget(new SliderWidget(3, 18, 1)) mineCount: number = 6
  @input @hint("Delay between flood-reveal tiles") @widget(new SliderWidget(0.02, 0.15, 0.01)) revealDelaySeconds: number = 0.045
  @ui.group_end
  @ui.separator
  @ui.group_start("Preview")
  @input @hint("Enable button-driven movement in Lens Studio Preview only") useSimulatedPlayer: boolean = true
  @input @hint("Board center distance in front of the tracked camera, in centimeters") @widget(new SliderWidget(200, 450, 10)) boardForwardDistanceCm: number = 340
  @input @hint("Fixed world Y of the Preview floor in centimeters; calibrated for Sunlit Outdoor at the default camera pose") @widget(new SliderWidget(-300, 0, 5)) emulatorFloorY: number = -170
  @input @hint("Print coordinate, mine, and state diagnostics") debugLogging: boolean = true
  @ui.group_end

  private board!: StepSweeperBoardManager
  private tracker!: StepSweeperPlayerGridTracker
  private revealSystem!: StepSweeperRevealSystem
  private flagInteraction!: StepSweeperFlagInteraction
  private floorPlacement!: StepSweeperFloorPlacement
  private audio!: StepSweeperAudioController
  private state = new StepSweeperGameState()
  private simulatedRow = 0
  private simulatedColumn = 2
  private simulationEnabled = false
  private currentPlayerCell: StepSweeperCellData | null = null
  private targetCell: StepSweeperCellData | null = null
  private queuedReveals: QueuedReveal[] = []
  private winCheckAt = -1
  private showDebugMines = false
  private musicMuted = false
  private progress!: StepSweeperProgress
  private difficultyIndex = 1
  private difficulty!: StepSweeperDifficulty
  private viewBuilt = false
  private allowProgressRecord = true
  private lossResultEvent!: DelayedCallbackEvent
  private lossGeneration = -1

  onAwake(): void {
    if (!this.boardRoot || !this.cameraObject || !this.cellView || !this.gameUI) {
      console.error("[SpecsSweeper] Required @input missing. Check Phase B wiring.")
      return
    }
    this.progress = new StepSweeperProgress()
    this.difficultyIndex = this.progress.loadDifficultyIndex()
    this.configureDifficulty(false)
    this.floorPlacement = new StepSweeperFloorPlacement(this.boardRoot)
    if (!this.cameraObject.getComponent("Component.AudioListenerComponent")) {
      this.cameraObject.createComponent("Component.AudioListenerComponent")
    }
    this.audio = new StepSweeperAudioController(this.getSceneObject(), this.startAccentTrack)
    this.simulationEnabled = global.deviceInfoSystem.isEditor() && this.useSimulatedPlayer
    this.lossResultEvent = this.createEvent("DelayedCallbackEvent") as DelayedCallbackEvent
    this.lossResultEvent.bind(() => {
      if (this.state.phase !== StepSweeperPhase.Lost || this.state.generation !== this.lossGeneration) return
      const best = this.progress.bestSeconds(this.difficulty.id)
      this.gameUI.showEnd(false, this.formatTime(), this.state.steps, this.board.flagsUsed, this.difficulty.id, this.formatStoredTime(best), this.progress.wins(this.difficulty.id), 0, false, this.board.revealedSafeCells, this.board.totalSafeCells)
    })
    this.createEvent("OnStartEvent").bind(() => this.onStart())
    this.createEvent("UpdateEvent").bind(() => this.onUpdate())
    console.log("[SpecsSweeper] READY — press Start Game")
  }

  private onStart(): void {
    this.gameUI.configureDebugControls(this.simulationEnabled)
    this.gameUI.setViewer(this.cameraObject)
    this.cellView.setClueCamera(this.cameraObject)
    this.cellView.build(this.board)
    this.gameUI.setArenaDimensions(this.board.columns * this.board.cellSizeCm, this.board.rows * this.board.cellSizeCm)
    this.viewBuilt = true
    this.cellView.onCellTapped.add(cell => this.toggleFlagAt(cell))
    // Give Preview and the intro UI an immediate stable anchor; on device the
    // World Query pass below refines this to a detected floor surface.
    if (global.deviceInfoSystem.isEditor()) {
      this.floorPlacement.placeAtPreviewFloor(this.cameraObject, this.boardForwardDistanceCm, this.emulatorFloorY)
    } else {
      this.floorPlacement.placeRelativeToCamera(this.cameraObject, this.boardForwardDistanceCm, this.emulatorFloorY)
    }
    this.gameUI.setSpatialAnchor(this.boardRoot)
    this.boardRoot.enabled = false
    this.bindUI()
    this.syncDifficultyUI()
    this.gameUI.showIntro()
    this.requestBoardPlacement()
    for (const interactor of SIK.InteractionManager.getTargetingInteractors()) {
      interactor.onTriggerStart.add((interactable) => {
        if (!interactable && this.state.phase === StepSweeperPhase.Playing) this.toggleFlag()
      })
    }
  }

  private bindUI(): void {
    this.gameUI.onStartGame.add(() => this.startGame())
    this.gameUI.onRestart.add(() => this.startGame())
    this.gameUI.onPlayAgain.add(() => this.startGame())
    this.gameUI.onMoveNorth.add(() => this.moveSimulated(-1, 0))
    this.gameUI.onMoveSouth.add(() => this.moveSimulated(1, 0))
    this.gameUI.onMoveWest.add(() => this.moveSimulated(0, -1))
    this.gameUI.onMoveEast.add(() => this.moveSimulated(0, 1))
    this.gameUI.onTargetNext.add(() => this.targetNext())
    this.gameUI.onToggleFlag.add(() => this.toggleFlag())
    this.gameUI.onForceWin.add(() => this.forceWin())
    this.gameUI.onForceLoss.add(() => this.forceLoss())
    this.gameUI.onToggleMines.add(() => this.toggleDebugMines())
    this.gameUI.onToggleMusic.add(() => this.toggleMusic())
    this.gameUI.onCycleDifficulty.add(() => this.cycleDifficulty())
    this.gameUI.onRecenter.add(() => this.requestBoardPlacement())
  }

  private startGame(): void {
    this.lossResultEvent.enabled = false
    this.boardRoot.enabled = true
    this.board.reset()
    this.tracker.reset()
    this.state.start()
    this.allowProgressRecord = true
    this.queuedReveals = []
    this.winCheckAt = -1
    this.currentPlayerCell = null
    this.simulatedRow = 0
    this.simulatedColumn = Math.floor(this.board.columns * 0.5) - 1
    this.targetCell = this.board.cell(0, Math.min(this.board.columns - 1, this.simulatedColumn + 1))
    this.cellView.reset(this.board)
    this.cellView.setTarget(this.targetCell)
    this.gameUI.showGame()
    this.cellView.playStartSequence()
    this.audio.playStart()
    const trackedPosition = this.trackedPlayerWorldPosition()
    if (this.tracker.current(trackedPosition)) {
      this.processTrackedPlayerPosition(trackedPosition)
    }
    console.log(`[SpecsSweeper] GAME_STARTED generation=${this.state.generation}`)
  }

  private onUpdate(): void {
    if (this.state.phase !== StepSweeperPhase.Playing) return
    const trackedPosition = this.trackedPlayerWorldPosition()
    const trackedCell = this.tracker.current(trackedPosition)
    if (trackedCell) {
      this.processTrackedPlayerPosition(trackedPosition)
      const viewTarget = this.flagInteraction.targetFromView(this.cameraObject)
      if (viewTarget !== this.targetCell) {
        this.targetCell = viewTarget
        this.cellView.setTarget(this.targetCell)
      }
    } else if (!this.simulationEnabled) {
      this.processPlayerPosition(trackedPosition)
    }
    while (this.queuedReveals.length > 0 && this.queuedReveals[0].readyAt <= getTime()) {
      const queued = this.queuedReveals.shift() as QueuedReveal
      this.cellView.refreshCell(queued.cell, true)
      this.audio.playReveal(this.cellWorldPosition(queued.cell, 3))
    }
    if (this.winCheckAt > 0 && getTime() >= this.winCheckAt && this.queuedReveals.length === 0) {
      this.winCheckAt = -1
      this.checkWin()
    }
    this.updateHUD()
  }

  private processPlayerPosition(worldPosition: vec3): void {
    const current = this.tracker.current(worldPosition)
    this.currentPlayerCell = current
    this.cellView.setPlayer(current)
    const entered = this.tracker.track(worldPosition)
    if (!entered) return
    this.state.steps++
    if (this.debugLogging) console.log(`[SpecsSweeper] ENTER row=${entered.row} column=${entered.column}`)
    this.enterCell(entered)
  }

  private processTrackedPlayerPosition(worldPosition: vec3): void {
    const cell = this.tracker.current(worldPosition)
    if (cell) {
      this.simulatedRow = cell.row
      this.simulatedColumn = cell.column
    }
    this.processPlayerPosition(worldPosition)
  }

  private trackedPlayerWorldPosition(): vec3 {
    const head = this.cameraObject.getTransform().getWorldPosition()
    return new vec3(head.x, this.boardRoot.getTransform().getWorldPosition().y, head.z)
  }

  private enterCell(cell: StepSweeperCellData): void {
    if (!this.board.minesPlaced) {
      this.board.placeMines(cell, 0x51e9 + this.state.generation * 7919)
      const mineCoords = this.board.cells.filter((item) => item.hasMine).map((item) => `${item.row},${item.column}`).join("|")
      const protectedCoords = [cell, ...this.board.neighbors(cell)].map((item) => `${item.row},${item.column}`).join("|")
      console.log(`[SpecsSweeper] MINES_PLACED count=${this.board.mineCount} protected=${protectedCoords} mines=${mineCoords}`)
    }
    const entryResult = resolveStepSweeperCellEntry(cell)
    if (entryResult === StepSweeperCellEntryResult.Ignored) return
    if (entryResult === StepSweeperCellEntryResult.Mine) {
      this.lose(cell)
      return
    }
    const order = this.revealSystem.revealOrder(cell)
    const started = getTime()
    for (let i = 0; i < order.length; i++) {
      order[i].isRevealed = true
      this.queuedReveals.push({cell: order[i], readyAt: started + i * this.revealDelaySeconds})
    }
    if (order.length > 0) {
      this.winCheckAt = started + (order.length - 1) * this.revealDelaySeconds
      console.log(`[SpecsSweeper] REVEAL origin=${cell.row},${cell.column} value=${cell.adjacentMineCount} count=${order.length}`)
    }
  }

  private moveSimulated(deltaRow: number, deltaColumn: number): void {
    if (this.state.phase !== StepSweeperPhase.Playing || !this.simulationEnabled) return
    this.simulatedRow = Math.max(0, Math.min(this.board.rows - 1, this.simulatedRow + deltaRow))
    this.simulatedColumn = Math.max(0, Math.min(this.board.columns - 1, this.simulatedColumn + deltaColumn))
    this.processPlayerPosition(this.simulatedWorldPosition())
    this.updateHUD()
  }

  private simulatedWorldPosition(): vec3 {
    const cell = this.board.cell(this.simulatedRow, this.simulatedColumn) as StepSweeperCellData
    return this.boardRoot.getTransform().getWorldTransform().multiplyPoint(this.board.boardLocalPosition(cell, 0))
  }

  private targetNext(): void {
    if (this.state.phase !== StepSweeperPhase.Playing) return
    const start = this.targetCell ? this.board.index(this.targetCell) + 1 : 0
    for (let offset = 0; offset < this.board.cells.length; offset++) {
      const cell = this.board.cells[(start + offset) % this.board.cells.length]
      if (!cell.isRevealed) {
        this.targetCell = cell
        this.cellView.setTarget(cell)
        this.updateHUD()
        return
      }
    }
  }

  private toggleFlag(): void {
    this.toggleFlagAt(this.targetCell)
  }

  private toggleFlagAt(cell: StepSweeperCellData | null): void {
    if (this.state.phase !== StepSweeperPhase.Playing) return
    if (this.flagInteraction.toggle(cell)) {
      this.targetCell = cell
      this.cellView.setTarget(cell)
      this.audio.playFlag()
      this.cellView.refreshCell(cell as StepSweeperCellData, true)
      console.log(`[SpecsSweeper] FLAG row=${cell?.row} column=${cell?.column} state=${cell?.isFlagged} source=tile-tap`)
      this.updateHUD()
    }
  }

  private lose(cell: StepSweeperCellData): void {
    this.state.finish(false)
    this.queuedReveals = []
    this.cellView.revealAllMines(this.board)
    this.cellView.playMineBurst(cell)
    this.audio.playMine(this.cellWorldPosition(cell, 5))
    this.lossGeneration = this.state.generation
    this.lossResultEvent.enabled = true
    this.lossResultEvent.reset(0.95)
    console.log(`[SpecsSweeper] LOSS mine=${cell.row},${cell.column}`)
  }

  private checkWin(): void {
    if (this.board.revealedSafeCells !== this.board.totalSafeCells) return
    this.state.finish(true)
    this.audio.playWin()
    this.cellView.playVictory()
    const result = this.allowProgressRecord
      ? this.progress.recordWin(this.difficulty, this.state.elapsed(), this.state.steps)
      : this.currentProgress()
    this.gameUI.showEnd(true, this.formatTime(), this.state.steps, this.board.flagsUsed, this.difficulty.id, this.formatStoredTime(result.bestSeconds), result.wins, result.score, result.isNewBest, this.board.revealedSafeCells, this.board.totalSafeCells)
    this.syncDifficultyUI()
    console.log(`[SpecsSweeper] WIN time=${this.formatTime()} steps=${this.state.steps}`)
  }

  private cellWorldPosition(cell: StepSweeperCellData, height: number): vec3 {
    return this.boardRoot.getTransform().getWorldTransform().multiplyPoint(this.board.boardLocalPosition(cell, height))
  }

  private forceWin(): void {
    if (this.state.phase !== StepSweeperPhase.Playing) return
    if (!this.board.minesPlaced) this.board.placeMines(this.board.cell(this.simulatedRow, this.simulatedColumn) as StepSweeperCellData, 12345)
    for (const cell of this.board.cells) {
      if (!cell.hasMine) {
        cell.isRevealed = true
        this.cellView.refreshCell(cell, false)
      }
    }
    this.allowProgressRecord = false
    this.updateHUD()
    this.checkWin()
  }

  private forceLoss(): void {
    if (this.state.phase !== StepSweeperPhase.Playing) return
    if (!this.board.minesPlaced) this.board.placeMines(this.board.cell(this.simulatedRow, this.simulatedColumn) as StepSweeperCellData, 54321)
    const mine = this.board.cells.find((cell) => cell.hasMine)
    if (mine) this.lose(mine)
  }

  private toggleDebugMines(): void {
    this.showDebugMines = !this.showDebugMines
    this.cellView.setDebugMines(this.board, this.showDebugMines)
    console.log(`[SpecsSweeper] DEBUG_MINES visible=${this.showDebugMines}`)
  }

  private toggleMusic(): void {
    this.musicMuted = !this.musicMuted
    this.audio.setMusicMuted(this.musicMuted)
    this.gameUI.setMusicMuted(this.musicMuted)
    console.log(`[SpecsSweeper] MUSIC_MUTED state=${this.musicMuted}`)
  }

  private updateHUD(): void {
    const current = this.currentPlayerCell
    this.gameUI.updateHUD(
      this.formatTime(), this.board.flagsUsed, this.board.mineCount,
      this.board.totalSafeCells - this.board.revealedSafeCells,
      current?.row ?? -1, current?.column ?? -1,
      current && current.isRevealed && !current.hasMine ? current.adjacentMineCount : -1,
      this.targetCell?.row ?? -1, this.targetCell?.column ?? -1,
    )
  }

  private formatTime(): string {
    const total = Math.floor(this.state.elapsed())
    const minutes = Math.floor(total / 60)
    const seconds = total % 60
    return `${minutes < 10 ? "0" : ""}${minutes}:${seconds < 10 ? "0" : ""}${seconds}`
  }

  private configureDifficulty(rebuildView: boolean): void {
    this.difficulty = STEP_SWEEPER_DIFFICULTIES[this.difficultyIndex]
    this.rows = this.difficulty.rows
    this.columns = this.difficulty.columns
    this.cellSizeCm = this.difficulty.cellSizeCm
    this.mineCount = this.difficulty.mineCount
    this.board = new StepSweeperBoardManager(this.difficulty.rows, this.difficulty.columns, this.difficulty.cellSizeCm, this.difficulty.mineCount)
    this.tracker = new StepSweeperPlayerGridTracker(this.board, this.boardRoot)
    this.revealSystem = new StepSweeperRevealSystem(this.board)
    this.flagInteraction = new StepSweeperFlagInteraction(this.board, this.boardRoot)
    if (rebuildView && this.viewBuilt) {
      this.cellView.build(this.board)
      this.gameUI.setArenaDimensions(this.board.columns * this.board.cellSizeCm, this.board.rows * this.board.cellSizeCm)
    }
  }

  private cycleDifficulty(): void {
    if (this.state.phase === StepSweeperPhase.Playing) return
    this.difficultyIndex = (this.difficultyIndex + 1) % STEP_SWEEPER_DIFFICULTIES.length
    this.progress.saveDifficulty(STEP_SWEEPER_DIFFICULTIES[this.difficultyIndex].id)
    this.configureDifficulty(true)
    this.boardRoot.enabled = false
    this.syncDifficultyUI()
    this.gameUI.showIntro()
    console.log(`[SpecsSweeper] DIFFICULTY mode=${this.difficulty.id} rows=${this.board.rows} columns=${this.board.columns} mines=${this.board.mineCount}`)
  }

  private requestBoardPlacement(): void {
    const boardWasEnabled = this.boardRoot.enabled
    this.gameUI.setPlacementStatus(global.deviceInfoSystem.isEditor() ? "PLACING PREVIEW BOARD..." : "LOOK AT THE FLOOR...")
    this.floorPlacement.recenter(this.cameraObject, this.boardForwardDistanceCm, this.emulatorFloorY, result => {
      this.boardRoot.enabled = boardWasEnabled
      if (result.reason !== "no-floor") {
        this.gameUI.setSpatialAnchor(this.boardRoot)
        this.tracker.reset()
        this.currentPlayerCell = null
        this.cellView.setPlayer(null)
      }
      this.gameUI.setPlacementStatus(result.reason === "surface"
        ? "FLOOR LOCKED"
        : result.reason === "preview"
          ? "PREVIEW PLACEMENT"
          : "NO FLOOR — LOOK DOWN & RETRY")
      console.log(`[SpecsSweeper] PLACEMENT result=${result.reason}`)
    })
  }

  private syncDifficultyUI(): void {
    this.gameUI.setDifficulty(
      this.difficulty.id,
      this.difficulty.mineCount,
      this.formatStoredTime(this.progress.bestSeconds(this.difficulty.id)),
      this.progress.wins(this.difficulty.id),
    )
  }

  private currentProgress(): StepSweeperWinProgress {
    return {
      bestSeconds: this.progress.bestSeconds(this.difficulty.id),
      isNewBest: false,
      wins: this.progress.wins(this.difficulty.id),
      score: 0,
    }
  }

  private formatStoredTime(totalSeconds: number | null): string {
    if (totalSeconds === null) return "—"
    const minutes = Math.floor(totalSeconds / 60)
    const seconds = totalSeconds % 60
    return `${minutes < 10 ? "0" : ""}${minutes}:${seconds < 10 ? "0" : ""}${seconds}`
  }
}
