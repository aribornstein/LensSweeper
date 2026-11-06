import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {findSceneObjectByName, sleep} from "Leaf.lspkg/Utils/common/Utils"
import {
  resolveStepSweeperCellEntry,
  StepSweeperCellData,
  StepSweeperCellEntryResult,
} from "../StepSweeperCellData"
import {StepSweeperLeafInteractor} from "./StepSweeperLeafInteractor"

@component
export class StepSweeperCoreFlowScenario extends Scenario {
  async run(): Promise<void> {
    const flaggedMine = new StepSweeperCellData(0, 0)
    flaggedMine.hasMine = true
    flaggedMine.isFlagged = true
    expect(resolveStepSweeperCellEntry(flaggedMine)).toBe(StepSweeperCellEntryResult.Ignored)
    flaggedMine.isFlagged = false
    expect(resolveStepSweeperCellEntry(flaggedMine)).toBe(StepSweeperCellEntryResult.Mine)

    const interactor = new StepSweeperLeafInteractor()
    await sleep(1500)

    const intro = findSceneObjectByName("SpecsSweeperIntro")
    await interactor.press(intro.enabled ? "StartGame" : "Restart")

    const hud = findSceneObjectByName("SpecsSweeperHUD")
    const debug = findSceneObjectByName("SpecsSweeperDebug")
    expect(hud.enabled).toBe(true)
    expect(debug.enabled).toBe(false)
    await interactor.press("HudToggleDebug")
    expect(debug.enabled).toBe(true)

    const position = findSceneObjectByName("Text-PLAYER 0,2").getComponent("Component.Text") as Text
    const safe = findSceneObjectByName("Text-30").getComponent("Component.Text") as Text
    const clue = findSceneObjectByName("Text-STEP ON A TILE TO REVEAL").getComponent("Component.Text") as Text
    const startingPosition = position.text
    const flags = findSceneObjectByName("Text-0 / 6").getComponent("Component.Text") as Text
    const startingFlags = flags.text
    // A tile is itself an SIK target: tap once to place a flag and again to
    // remove it. This is the primary room-scale interaction, not a HUD action.
    await interactor.press("Cell_0_0")
    expect(flags.text === startingFlags).toBe(false)
    const placedFlag = findSceneObjectByName("RedFlag_0_0")
    expect(placedFlag.enabled).toBe(true)
    await interactor.press("Cell_0_0")
    expect(flags.text).toBe(startingFlags)
    expect(placedFlag.enabled).toBe(false)
    // Starting the game no longer auto-reveals a simulated tile. The first
    // physical step (or an explicit debug move) must own the first reveal.
    expect(safe.text).toBe("30")
    await interactor.press("DebugMoveSouth")
    expect(position.text === startingPosition).toBe(false)
    expect(safe.text === "30").toBe(false)
    expect(clue.text).toBe("CLEAR TILE  •  0 ADJACENT MINES")
    await sleep(900)
    const firstCell = findSceneObjectByName("Cell_1_2")
    const child = (parent: SceneObject, name: string): SceneObject => {
      for (let i = 0; i < parent.getChildrenCount(); i++) if (parent.getChild(i).name === name) return parent.getChild(i)
      throw new Error(`Missing child ${name}`)
    }
    expect(child(firstCell, "CoveredFloorWash").enabled).toBe(false)
    expect(child(firstCell, "CellRevealScan").enabled).toBe(false)
    const gridVisual = findSceneObjectByName("FieldGrid").getComponent("Component.RenderMeshVisual") as RenderMeshVisual
    expect(gridVisual.mainMaterial.mainPass.depthTest).toBe(true)
    expect(gridVisual.mainMaterial.mainPass.depthWrite).toBe(false)
    // The first flood reveal includes zero markers and actual extruded clues.
    // Verify billboard orientation again after a viewer position change.
    const camera = findSceneObjectByName("Camera Object")
    const cameraTransform = camera.getTransform()
    const originalCameraPosition = cameraTransform.getWorldPosition()
    const spatialClues: SceneObject[] = []
    const visit = (object: SceneObject): void => {
      if (!object.enabled) return
      if (object.name === "SpatialNumeral") spatialClues.push(object)
      for (let i = 0; i < object.getChildrenCount(); i++) visit(object.getChild(i))
    }
    for (let i = 0; i < global.scene.getRootObjectsCount(); i++) visit(global.scene.getRootObject(i))
    expect(spatialClues.length > 0).toBe(true)
    const verifyClues = (): void => {
      for (const object of spatialClues) {
        const transform = object.getTransform()
        const toViewer = cameraTransform.getWorldPosition().sub(transform.getWorldPosition()).normalize()
        const facing = transform.getWorldRotation().multiplyVec3(vec3.forward())
        expect(facing.dot(toViewer) > 0.99).toBe(true)
        const digit = object.getChild(0).getComponent("Component.Text3D") as Text3D
        expect(digit.extrusionDepth > 0).toBe(true)
        expect(Number(digit.text) > 0 && Number(digit.text) <= 8).toBe(true)
        expect(digit.mainMaterial.mainPass.depthTest).toBe(true)
      }
    }
    verifyClues()
    try {
      cameraTransform.setWorldPosition(originalCameraPosition.add(new vec3(60, 0, 0)))
      await sleep(150)
      verifyClues()
    } finally {
      cameraTransform.setWorldPosition(originalCameraPosition)
    }
    const safeBeforeNumberedStep = safe.text
    await interactor.press("DebugMoveEast")
    await interactor.press("DebugMoveEast")
    await interactor.press("DebugMoveEast")
    expect(position.text).toBe("PLAYER 1,5")
    expect(safe.text === safeBeforeNumberedStep).toBe(false)

    await interactor.press("DebugTargetNext")
    await interactor.press("DebugToggleFlag")
    expect(flags.text === startingFlags).toBe(false)
    await interactor.press("DebugToggleFlag")
    expect(flags.text).toBe(startingFlags)

    await interactor.press("DebugForceWin")
    const end = findSceneObjectByName("SpecsSweeperEnd")
    const endTitle = findSceneObjectByName("Text-Room cleared").getComponent("Component.Text") as Text
    expect(end.enabled).toBe(true)
    expect(endTitle.text).toBe("Room cleared")
    expect(findSceneObjectByName("VictorySweep").enabled).toBe(true)
    const toCard = end.getTransform().getWorldPosition().sub(cameraTransform.getWorldPosition())
    expect(Math.abs(toCard.dot(cameraTransform.getWorldRotation().multiplyVec3(vec3.back())) - 170) < 0.1).toBe(true)
    expect(Math.abs(toCard.dot(cameraTransform.getWorldRotation().multiplyVec3(vec3.up())) - 22) < 0.1).toBe(true)
    expect(end.getTransform().getWorldRotation().multiplyVec3(vec3.forward()).dot(toCard.normalize().uniformScale(-1)) > 0.999).toBe(true)

    await interactor.press("PlayAgain")
    expect(end.enabled).toBe(false)
    expect(hud.enabled).toBe(true)
    expect(findSceneObjectByName("VictorySweep").enabled).toBe(false)

    // Mine feedback is board-local and depth-tested, with pooled fragments
    // and a delayed result card so the burst remains visible.
    await interactor.press("HudToggleDebug")
    // Sample the flash before its 0.4s cutoff, allowing for trigger overhead.
    await interactor.press("DebugForceLoss", 220)
    const explosionParticle = findSceneObjectByName("ExplosionParticle-0")
    expect(explosionParticle.enabled).toBe(true)
    const particleVisual = explosionParticle.getChild(0).getComponent("Component.RenderMeshVisual") as RenderMeshVisual
    expect(particleVisual.mainMaterial.mainPass.depthTest).toBe(true)
    expect(explosionParticle.getTransform().getLocalScale().x > 1).toBe(true)
    expect(end.enabled).toBe(false)
    expect(findSceneObjectByName("BurstHotCore").enabled).toBe(true)
    await sleep(150)
    const ring = findSceneObjectByName("MineShockwave")
    expect(ring.enabled).toBe(true)
    const initialRadius = ring.getTransform().getLocalScale().x
    await sleep(200)
    expect(ring.getTransform().getLocalScale().x > initialRadius).toBe(true)
    await sleep(800)
    expect(end.enabled).toBe(true)
    expect(endTitle.text).toBe("Mine hit")
    const content = findSceneObjectByName("BoardContent")
    for (let i = 0; i < content.getChildrenCount(); i++) {
      const cellObject = content.getChild(i)
      if (!cellObject.name.startsWith("Cell_")) continue
      for (let j = 0; j < cellObject.getChildrenCount(); j++) {
        const marker = cellObject.getChild(j)
        if (marker.name === "MineLocation" && marker.enabled) expect(child(cellObject, "CoveredFloorWash").enabled).toBe(false)
      }
    }
    expect(explosionParticle.enabled).toBe(false)
    expect(ring.enabled).toBe(false)
    expect(findSceneObjectByName("MineHitMarker").enabled).toBe(true)
    await interactor.press("PlayAgain")
    expect(findSceneObjectByName("MineBurst").enabled).toBe(false)
    await sleep(800)
    expect(end.enabled).toBe(false)
  }
}
