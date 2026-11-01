import Event, {PublicApi} from "SpectaclesInteractionKit.lspkg/Utils/Event"
import {FlexLayout} from "SpectaclesUIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexLayout"
import {FlexItem} from "SpectaclesUIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexItem"
import {FlexAlign, FlexDirection, FlexJustify} from "SpectaclesUIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexTypes"
import {Button} from "SpectaclesUIKit.lspkg/Scripts/Components/Button/Button"
import {ElementContent} from "SpectaclesUIKit.lspkg/Scripts/Components/Content/ElementContent"
import {RoundedRectangle, RoundedRectBlendMode} from "SpectaclesUIKit.lspkg/Scripts/Visuals/RoundedRectangle/RoundedRectangle"

const ICON_PLAY = requireAsset("../Icons/play_arrow.png") as Texture
const ICON_RESTART = requireAsset("../Icons/restart_alt.png") as Texture
const ICON_TROPHY = requireAsset("../Icons/trophy.png") as Texture
const ICON_WARNING = requireAsset("../Icons/warning.png") as Texture
const ICON_VOLUME_UP = requireAsset("../Icons/volume_up.png") as Texture
const ICON_VOLUME_OFF = requireAsset("../Icons/volume_off.png") as Texture
const ICON_FLAG = requireAsset("../Icons/flag.png") as Texture

type TextRole = "Title1" | "Title2" | "HeadlineXL" | "Headline1" | "Headline2" | "Subheadline" | "Button" | "Callout" | "Body" | "Caption"
const TYPE_SCALE: Record<TextRole, {size: number; weight: number}> = {
  Title1: {size: 260, weight: 700}, Title2: {size: 220, weight: 700}, HeadlineXL: {size: 160, weight: 700},
  Headline1: {size: 145, weight: 700}, Headline2: {size: 125, weight: 700}, Subheadline: {size: 105, weight: 700},
  Button: {size: 100, weight: 700}, Callout: {size: 100, weight: 700}, Body: {size: 92, weight: 500}, Caption: {size: 82, weight: 500},
}
function applyTextRole(text: Text, role: TextRole): void {
  text.size = TYPE_SCALE[role].size
  text.weight = TYPE_SCALE[role].weight
}

/** Lightweight spatial UIKit view anchored around the room-scale board. */
@component
export class StepSweeperGameUI extends BaseScriptComponent {
  @ui.label('<span style="color: #22D3EE;">Specs Sweeper UI</span>')
  @ui.separator
  @ui.group_start("Settings")
  @input @hint("Show development controls in Preview") debugControls: boolean = true
  @ui.group_end

  private introPanel!: SceneObject
  private hudPanel!: SceneObject
  private endPanel!: SceneObject
  private debugPanel!: SceneObject
  private timerText!: Text
  private flagsText!: Text
  private safeText!: Text
  private guidanceText!: Text
  private positionText!: Text
  private targetText!: Text
  private endTitleText!: Text
  private endStatsText!: Text
  private endProgressText!: Text
  private difficultyContent!: ElementContent
  private introBestText!: Text
  private hudModeText!: Text
  private placementText!: Text
  private endIconContent!: ElementContent
  private musicButtonContents: ElementContent[] = []
  private debugButtonObject: SceneObject | null = null
  private debugPanelVisible = false
  private panelAnimation: {object: SceneObject, startedAt: number} | null = null

  private _onStartGame = new Event<void>()
  private _onRestart = new Event<void>()
  private _onPlayAgain = new Event<void>()
  private _onMoveNorth = new Event<void>()
  private _onMoveSouth = new Event<void>()
  private _onMoveWest = new Event<void>()
  private _onMoveEast = new Event<void>()
  private _onTargetNext = new Event<void>()
  private _onToggleFlag = new Event<void>()
  private _onForceWin = new Event<void>()
  private _onForceLoss = new Event<void>()
  private _onToggleMines = new Event<void>()
  private _onToggleMusic = new Event<void>()
  private _onCycleDifficulty = new Event<void>()
  private _onRecenter = new Event<void>()

  get onStartGame(): PublicApi<void> { return this._onStartGame.publicApi() }
  get onRestart(): PublicApi<void> { return this._onRestart.publicApi() }
  get onPlayAgain(): PublicApi<void> { return this._onPlayAgain.publicApi() }
  get onMoveNorth(): PublicApi<void> { return this._onMoveNorth.publicApi() }
  get onMoveSouth(): PublicApi<void> { return this._onMoveSouth.publicApi() }
  get onMoveWest(): PublicApi<void> { return this._onMoveWest.publicApi() }
  get onMoveEast(): PublicApi<void> { return this._onMoveEast.publicApi() }
  get onTargetNext(): PublicApi<void> { return this._onTargetNext.publicApi() }
  get onToggleFlag(): PublicApi<void> { return this._onToggleFlag.publicApi() }
  get onForceWin(): PublicApi<void> { return this._onForceWin.publicApi() }
  get onForceLoss(): PublicApi<void> { return this._onForceLoss.publicApi() }
  get onToggleMines(): PublicApi<void> { return this._onToggleMines.publicApi() }
  get onToggleMusic(): PublicApi<void> { return this._onToggleMusic.publicApi() }
  get onCycleDifficulty(): PublicApi<void> { return this._onCycleDifficulty.publicApi() }
  get onRecenter(): PublicApi<void> { return this._onRecenter.publicApi() }

  onAwake(): void {
    this.sceneObject.createComponent("Component.Canvas")
    this.introPanel = this.buildIntro()
    this.hudPanel = this.buildHud()
    this.endPanel = this.buildEnd()
    this.debugPanel = this.buildDebug()
    this.createEvent("UpdateEvent").bind(() => this.animatePanelEntrance())
    const delayed = this.createEvent("DelayedCallbackEvent") as DelayedCallbackEvent
    delayed.bind(() => {
      this.hudPanel.enabled = false
      this.endPanel.enabled = false
      this.debugPanel.enabled = false
    })
    delayed.reset(0.15)
  }

  configureDebugControls(runningInEditor: boolean): void {
    this.debugControls = runningInEditor && this.debugControls
    if (this.debugButtonObject) this.debugButtonObject.enabled = this.debugControls
  }

  setSpatialAnchor(boardRoot: SceneObject): void {
    const boardTransform = boardRoot.getTransform()
    const transform = this.getSceneObject().getTransform()
    transform.setWorldPosition(boardTransform.getWorldPosition())
    transform.setWorldRotation(boardTransform.getWorldRotation())
  }

  setMusicMuted(muted: boolean): void {
    for (const content of this.musicButtonContents) {
      content.text = muted ? "UNMUTE" : "MUTE"
      // The label describes the action; the icon communicates current state.
      content.leadingIcon = muted ? ICON_VOLUME_OFF : ICON_VOLUME_UP
    }
  }

  setDifficulty(difficulty: string, mines: number, bestTime: string, wins: number): void {
    if (this.difficultyContent) this.difficultyContent.text = `MODE  ${difficulty}  •  ${mines} MINES`
    if (this.introBestText) this.introBestText.text = `BEST  ${bestTime}  •  ${wins} WINS`
    if (this.hudModeText) this.hudModeText.text = `${difficulty}  •  BEST ${bestTime}`
  }

  setPlacementStatus(status: string): void {
    if (this.placementText) this.placementText.text = status
  }

  showIntro(): void {
    this.introPanel.enabled = true
    this.hudPanel.enabled = false
    this.endPanel.enabled = false
    this.debugPanel.enabled = false
    this.beginPanelEntrance(this.introPanel)
  }

  showGame(): void {
    this.introPanel.enabled = false
    this.hudPanel.enabled = true
    this.endPanel.enabled = false
    this.debugPanelVisible = false
    this.debugPanel.enabled = false
    this.beginPanelEntrance(this.hudPanel)
  }

  showEnd(won: boolean, timeText: string, steps: number, flags: number, difficulty: string, bestTime: string, wins: number, score: number, isNewBest: boolean): void {
    this.introPanel.enabled = false
    this.hudPanel.enabled = false
    this.endPanel.enabled = true
    this.debugPanel.enabled = false
    this.endTitleText.text = won ? "ROOM CLEARED!" : "MINE HIT"
    this.endTitleText.textFill.color = won ? new vec4(0.2, 1, 0.7, 1) : new vec4(1, 0.28, 0.12, 1)
    this.endStatsText.text = `${timeText}   •   ${steps} STEPS   •   ${flags} FLAGS`
    this.endProgressText.text = won
      ? `${isNewBest ? "NEW BEST!  •  " : ""}${difficulty}  •  SCORE ${score}  •  ${wins} WINS`
      : `${difficulty}  •  BEST ${bestTime}  •  TRY AGAIN`
    this.endProgressText.textFill.color = isNewBest ? new vec4(1, 0.88, 0.18, 1) : new vec4(0.72, 0.94, 1, 1)
    this.endIconContent.leadingIcon = won ? ICON_TROPHY : ICON_WARNING
    this.beginPanelEntrance(this.endPanel)
  }

  private beginPanelEntrance(object: SceneObject): void {
    object.getTransform().setLocalScale(new vec3(0.94, 0.94, 0.94))
    this.panelAnimation = {object, startedAt: getTime()}
  }

  private animatePanelEntrance(): void {
    if (!this.panelAnimation) return
    const progress = Math.min(1, (getTime() - this.panelAnimation.startedAt) / 0.32)
    const overshoot = 1 + Math.sin(progress * Math.PI) * (1 - progress) * 0.035
    const scale = 0.94 + (1 - Math.pow(1 - progress, 3)) * 0.06
    this.panelAnimation.object.getTransform().setLocalScale(new vec3(scale * overshoot, scale * overshoot, scale * overshoot))
    if (progress >= 1) {
      this.panelAnimation.object.getTransform().setLocalScale(vec3.one())
      this.panelAnimation = null
    }
  }

  updateHUD(timeText: string, flags: number, mines: number, safeRemaining: number, row: number, column: number, adjacentMineCount: number, targetRow: number, targetColumn: number): void {
    if (!this.timerText) return
    this.timerText.text = `TIME  ${timeText}`
    this.flagsText.text = `${flags} / ${mines}`
    this.safeText.text = String(safeRemaining)
    if (row < 0 || adjacentMineCount < 0) {
      this.guidanceText.text = "STEP ONTO A TILE TO REVEAL ITS CLUE"
      this.guidanceText.textFill.color = new vec4(0.2, 0.85, 1, 1)
    } else if (adjacentMineCount === 0) {
      this.guidanceText.text = "CLEAR TILE  •  0 ADJACENT MINES"
      this.guidanceText.textFill.color = new vec4(0.25, 1, 0.7, 1)
    } else {
      const noun = adjacentMineCount === 1 ? "MINE" : "MINES"
      this.guidanceText.text = `${adjacentMineCount} ADJACENT ${noun}  •  STEP CAREFULLY`
      this.guidanceText.textFill.color = adjacentMineCount === 1
        ? new vec4(0.2, 0.85, 1, 1)
        : adjacentMineCount === 2
          ? new vec4(1, 0.85, 0.15, 1)
          : new vec4(1, 0.3, 0.1, 1)
    }
    this.positionText.text = row >= 0 ? `PLAYER ${row},${column}` : "PLAYER OUTSIDE BOARD"
    this.targetText.text = targetRow >= 0 ? `TARGET ${targetRow},${targetColumn}` : "TARGET —"
  }

  private buildIntro(): SceneObject {
    const panel = this.panel("SpecsSweeperIntro", new vec3(0, 138, -170), 108, 82)
    panel.getTransform().setLocalRotation(quat.angleAxis(Math.PI, vec3.up()))
    const flex = panel.getChild(0).getComponent(FlexLayout.getTypeName()) as FlexLayout
    this.addText(panel.getChild(0), flex, "SPECS SWEEPER", "Title1", 96, 12)
    this.addText(panel.getChild(0), flex, "YOUR FLOOR IS THE MINEFIELD", "Headline2", 96, 9)
    this.addText(panel.getChild(0), flex, "WALK TO REVEAL  •  TAP TO FLAG", "Body", 96, 9)
    this.difficultyContent = this.addButton(panel.getChild(0), flex, "IntroCycleDifficulty", "MODE  STANDARD  •  6 MINES", ICON_TROPHY, 82, () => this._onCycleDifficulty.invoke(), 11)
    this.introBestText = this.addText(panel.getChild(0), flex, "BEST  —  •  0 WINS", "Caption", 96, 7)
    const introActions = this.addButtonRow(panel.getChild(0), flex, [
      {name:"StartGame", label:"START", icon:ICON_PLAY, handler:() => this._onStartGame.invoke()},
      {name:"IntroRecenter", label:"PLACE", icon:ICON_RESTART, handler:() => this._onRecenter.invoke()},
      {name:"IntroToggleMusic", label:"MUTE", icon:ICON_VOLUME_UP, handler:() => this._onToggleMusic.invoke()},
    ])
    this.musicButtonContents.push(introActions[2])
    return panel
  }

  private buildHud(): SceneObject {
    const hud = global.scene.createSceneObject("SpecsSweeperHUD")
    hud.setParent(this.sceneObject)

    // Keep the panel's inner edge outside the 300 cm grid (x = ±150)
    // with a 2 cm physical gap, then toe it inward toward the player.
    const objective = this.panel("ObjectivePanel", new vec3(188, 56, -72), 72, 78, hud)
    objective.getTransform().setLocalRotation(quat.angleAxis(Math.PI + 0.30, vec3.up()))
    const objectiveContent = objective.getChild(0)
    const objectiveFlex = objectiveContent.getComponent(FlexLayout.getTypeName()) as FlexLayout
    const objectiveTitle = this.addText(objectiveContent, objectiveFlex, "◉  OBJECTIVE", "Subheadline", 62, 8)
    objectiveTitle.textFill.color = new vec4(0.12, 0.95, 1, 1)
    this.addText(objectiveContent, objectiveFlex, "CLEAR ALL SAFE TILES", "Headline2", 62, 10)
    this.addText(objectiveContent, objectiveFlex, "AVOID THE MINES", "Body", 62, 8)
    this.timerText = this.addText(objectiveContent, objectiveFlex, "TIME  00:00", "HeadlineXL", 62, 11)
    this.hudModeText = this.addText(objectiveContent, objectiveFlex, "STANDARD  •  BEST —", "Caption", 62, 7)
    this.guidanceText = this.addText(objectiveContent, objectiveFlex, "STEP ON A TILE TO REVEAL", "Callout", 62, 13)

    const controls = this.panel("ControlsPanel", new vec3(-185, 62, -72), 62, 92, hud)
    controls.getTransform().setLocalRotation(quat.angleAxis(Math.PI - 0.30, vec3.up()))
    const controlsContent = controls.getChild(0)
    const controlsFlex = controlsContent.getComponent(FlexLayout.getTypeName()) as FlexLayout
    const controlsTitle = this.addText(controlsContent, controlsFlex, "CONTROLS", "Subheadline", 52, 8)
    controlsTitle.textFill.color = new vec4(0.12, 0.95, 1, 1)
    this.addButton(controlsContent, controlsFlex, "Restart", "RESTART", ICON_RESTART, 52, () => this._onRestart.invoke(), 14)
    this.addButton(controlsContent, controlsFlex, "HudRecenter", "RECENTER", ICON_RESTART, 52, () => this._onRecenter.invoke(), 14)
    this.musicButtonContents.push(this.addButton(controlsContent, controlsFlex, "HudToggleMusic", "MUTE", ICON_VOLUME_UP, 52, () => this._onToggleMusic.invoke(), 14))
    const debugContent = this.addButton(controlsContent, controlsFlex, "HudToggleDebug", "DEBUG", ICON_WARNING, 52, () => this.toggleDebugPanel(), 14)
    this.debugButtonObject = debugContent.getSceneObject()
    this.placementText = this.addText(controlsContent, controlsFlex, "PLACEMENT READY", "Caption", 52, 7)

    const counters = this.panel("BoardFrontCounters", new vec3(0, 28, -168), 190, 34, hud)
    counters.getTransform().setLocalRotation(quat.angleAxis(Math.PI, vec3.up()))
    const counterContent = counters.getChild(0)
    const counterFlex = counterContent.getComponent(FlexLayout.getTypeName()) as FlexLayout
    counterFlex.direction = FlexDirection.Row
    counterFlex.columnGap = 6
    counterFlex.rowGap = 0
    this.flagsText = this.addMetric(counterContent, counterFlex, "FLAGS", ICON_FLAG, "0 / 6")
    this.safeText = this.addMetric(counterContent, counterFlex, "SAFE TILES LEFT", null, "30")
    return hud
  }

  private buildEnd(): SceneObject {
    const panel = this.panel("SpecsSweeperEnd", new vec3(0, 132, -170), 108, 70)
    panel.getTransform().setLocalRotation(quat.angleAxis(Math.PI, vec3.up()))
    const content = panel.getChild(0)
    const flex = content.getComponent(FlexLayout.getTypeName()) as FlexLayout
    const iconRow = global.scene.createSceneObject("EndIcon")
    iconRow.setParent(content)
    this.endIconContent = iconRow.createComponent(ElementContent.getTypeName()) as ElementContent
    this.endIconContent.leadingIcon = ICON_TROPHY
    this.endIconContent.iconLayout = "left"
    this.endIconContent.leadingIconSize = 7
    this.endIconContent.sizeOverride = new vec2(10, 8)
    this.addItem(flex, iconRow, 10, 8)
    this.endTitleText = this.addText(content, flex, "ROOM CLEARED!", "Title2", 96, 11)
    this.endStatsText = this.addText(content, flex, "00:00 • 0 STEPS • 0 FLAGS", "Body", 96, 8)
    this.endProgressText = this.addText(content, flex, "STANDARD • BEST —", "Caption", 96, 8)
    this.addButtonRow(content, flex, [
      {name:"PlayAgain", label:"PLAY AGAIN", icon:ICON_RESTART, handler:() => this._onPlayAgain.invoke()},
      {name:"EndCycleDifficulty", label:"CHANGE MODE", icon:ICON_TROPHY, handler:() => this._onCycleDifficulty.invoke()},
    ])
    return panel
  }

  private buildDebug(): SceneObject {
    const panel = this.panel("SpecsSweeperDebug", new vec3(-196, 136, 4), 90, 76)
    panel.getTransform().setLocalRotation(quat.angleAxis(Math.PI - 0.12, vec3.up()))
    const content = panel.getChild(0)
    const flex = content.getComponent(FlexLayout.getTypeName()) as FlexLayout
    this.addText(content, flex, "PREVIEW CONTROLS", "Headline2", 80, 9)
    this.positionText = this.addText(content, flex, "PLAYER 0,2", "Caption", 80, 7)
    this.targetText = this.addText(content, flex, "TARGET 0,3", "Caption", 80, 7)
    this.addButtonRow(content, flex, [
      {name:"DebugMoveNorth", label:"NORTH", icon:null, handler:() => this._onMoveNorth.invoke()},
      {name:"DebugMoveSouth", label:"SOUTH", icon:null, handler:() => this._onMoveSouth.invoke()},
      {name:"DebugMoveWest", label:"WEST", icon:null, handler:() => this._onMoveWest.invoke()},
    ])
    this.addButtonRow(content, flex, [
      {name:"DebugMoveEast", label:"EAST", icon:null, handler:() => this._onMoveEast.invoke()},
      {name:"DebugTargetNext", label:"TARGET", icon:null, handler:() => this._onTargetNext.invoke()},
      {name:"DebugToggleFlag", label:"FLAG", icon:null, handler:() => this._onToggleFlag.invoke()},
    ])
    this.addButtonRow(content, flex, [
      {name:"DebugToggleMines", label:"MINES", icon:ICON_WARNING, handler:() => this._onToggleMines.invoke()},
      {name:"DebugForceWin", label:"WIN", icon:ICON_TROPHY, handler:() => this._onForceWin.invoke()},
      {name:"DebugForceLoss", label:"LOSS", icon:ICON_WARNING, handler:() => this._onForceLoss.invoke()},
    ])
    return panel
  }

  private toggleDebugPanel(): void {
    if (!this.debugControls) return
    this.debugPanelVisible = !this.debugPanelVisible
    this.debugPanel.enabled = this.debugPanelVisible
  }

  private addButtonRow(parent: SceneObject, parentFlex: FlexLayout, buttons: {name:string, label:string, icon:Texture|null, handler:()=>void}[]): ElementContent[] {
    const row = global.scene.createSceneObject("DebugButtonRow")
    row.setParent(parent)
    const rowFlex = row.createComponent(FlexLayout.getTypeName()) as FlexLayout
    rowFlex.autoDiscoverItemsOnStart = false
    rowFlex.width = 82
    rowFlex.height = 10
    rowFlex.direction = FlexDirection.Row
    rowFlex.alignItems = FlexAlign.Center
    rowFlex.justifyContent = FlexJustify.Center
    rowFlex.columnGap = 1.5
    this.addItem(parentFlex, row, 82, 10)
    const buttonWidth = buttons.length === 2 ? 38 : 25.5
    const contents: ElementContent[] = []
    for (const data of buttons) contents.push(this.addButton(row, rowFlex, data.name, data.label, data.icon, buttonWidth, data.handler))
    return contents
  }

  private panel(name: string, position: vec3, width: number, height: number, parent: SceneObject = this.sceneObject): SceneObject {
    const panel = global.scene.createSceneObject(name)
    panel.setParent(parent)
    panel.getTransform().setLocalPosition(position)
    const plate = panel.createComponent(RoundedRectangle.getTypeName()) as RoundedRectangle
    plate.size = new vec2(width, height)
    plate.gradient = false
    // A teal-tinted fill stays visible on additive AR displays where pure black
    // reads as transparent, while remaining a single flat static surface.
    plate.backgroundColor = new vec4(0.035, 0.20, 0.24, 0.88)
    plate.blendMode = RoundedRectBlendMode.Normal
    plate.cornerRadius = 4
    plate.border = true
    plate.borderSize = 0.55
    plate.borderColor = new vec4(0.05, 0.95, 1, 1)
    const content = global.scene.createSceneObject("Content")
    content.setParent(panel)
    content.getTransform().setLocalPosition(new vec3(0, 0, 0.6))
    const flex = content.createComponent(FlexLayout.getTypeName()) as FlexLayout
    flex.autoDiscoverItemsOnStart = false
    flex.width = width
    flex.height = height
    flex.direction = FlexDirection.Column
    flex.alignItems = FlexAlign.Center
    flex.justifyContent = FlexJustify.Center
    flex.rowGap = 1.6
    flex.paddingTop = 3
    flex.paddingBottom = 3
    flex.paddingLeft = 4
    flex.paddingRight = 4
    return panel
  }

  private addText(parent: SceneObject, flex: FlexLayout, value: string, role: TextRole, width: number, height: number): Text {
    const object = global.scene.createSceneObject(`Text-${value}`)
    object.setParent(parent)
    const text = object.createComponent("Component.Text") as Text
    text.text = value
    text.depthTest = true
    text.textFill.color = new vec4(0.9, 0.98, 1, 1)
    applyTextRole(text, role)
    text.horizontalAlignment = HorizontalAlignment.Center
    text.verticalAlignment = VerticalAlignment.Center
    text.horizontalOverflow = HorizontalOverflow.Overflow
    text.verticalOverflow = VerticalOverflow.Overflow
    text.layoutRect = Rect.create(-width * 0.5, width * 0.5, -height * 0.5, height * 0.5)
    this.addItem(flex, object, width, height)
    return text
  }

  private addButton(parent: SceneObject, flex: FlexLayout, name: string, label: string, icon: Texture | null, width: number, handler: () => void, height: number = 10): ElementContent {
    const object = global.scene.createSceneObject(name)
    object.setParent(parent)
    const button = object.createComponent(Button.getTypeName()) as Button
    button.size = new vec3(width, height, 1)
    button.onTriggerUp.add(handler)
    const content = object.createComponent(ElementContent.getTypeName()) as ElementContent
    content.text = label
    content.textSize = TYPE_SCALE.Button.size
    content.sizeOverride = new vec2(width - 2, height - 1)
    content.contentAlignment = "center"
    if (icon) {
      content.leadingIcon = icon
      content.leadingIconSize = 5.2
      content.iconLayout = "left"
      content.spacing = 1.5
    }
    this.addItem(flex, object, width, height)
    return content
  }

  private addMetric(parent: SceneObject, flex: FlexLayout, label: string, icon: Texture | null, value: string): Text {
    const metric = global.scene.createSceneObject(`Metric-${label}`)
    metric.setParent(parent)
    const plateObject = global.scene.createSceneObject(`MetricSurface-${label}`)
    plateObject.setParent(metric)
    plateObject.getTransform().setLocalPosition(new vec3(0, 0, -0.2))
    const plate = plateObject.createComponent(RoundedRectangle.getTypeName()) as RoundedRectangle
    plate.size = new vec2(86, 26)
    plate.gradient = false
    plate.backgroundColor = new vec4(0.025, 0.14, 0.19, 0.94)
    plate.blendMode = RoundedRectBlendMode.Normal
    plate.cornerRadius = 3
    plate.border = true
    plate.borderSize = 0.42
    plate.borderColor = new vec4(0.08, 0.88, 1, 0.9)
    const metricFlex = metric.createComponent(FlexLayout.getTypeName()) as FlexLayout
    metricFlex.autoDiscoverItemsOnStart = false
    metricFlex.width = 86
    metricFlex.height = 26
    metricFlex.direction = FlexDirection.Column
    metricFlex.alignItems = FlexAlign.Center
    metricFlex.justifyContent = FlexJustify.Center
    metricFlex.rowGap = 1
    this.addItem(flex, metric, 86, 26)

    const labelRow = global.scene.createSceneObject(`MetricLabel-${label}`)
    labelRow.setParent(metric)
    const labelFlex = labelRow.createComponent(FlexLayout.getTypeName()) as FlexLayout
    labelFlex.autoDiscoverItemsOnStart = false
    labelFlex.width = 78
    labelFlex.height = 8
    labelFlex.direction = FlexDirection.Row
    labelFlex.alignItems = FlexAlign.Center
    labelFlex.justifyContent = FlexJustify.Center
    labelFlex.columnGap = 1.2
    this.addItem(metricFlex, labelRow, 78, 8)
    if (icon) {
      const iconObject = global.scene.createSceneObject(`MetricIcon-${label}`)
      iconObject.setParent(labelRow)
      const iconContent = iconObject.createComponent(ElementContent.getTypeName()) as ElementContent
      iconContent.text = " "
      iconContent.textSize = TYPE_SCALE.Caption.size
      iconContent.leadingIcon = icon
      iconContent.leadingIconSize = 5.5
      iconContent.iconLayout = "left"
      iconContent.contentAlignment = "center"
      iconContent.sizeOverride = new vec2(7, 7)
      this.addItem(labelFlex, iconObject, 7, 7)
    }
    const labelText = this.addText(labelRow, labelFlex, label, "Caption", icon ? 62 : 76, 7)
    labelText.textFill.color = new vec4(0.78, 0.98, 1, 1)
    const valueText = this.addText(metric, metricFlex, value, "HeadlineXL", 78, 12)
    valueText.textFill.color = new vec4(0.3, 1, 0.92, 1)
    return valueText
  }

  private addItem(flex: FlexLayout, object: SceneObject, width: number, height: number): void {
    const item = object.createComponent(FlexItem.getTypeName()) as FlexItem
    item.overrideWidth = width
    item.overrideHeight = height
    item.flexShrink = 0
    flex.addItems([item])
  }
}
