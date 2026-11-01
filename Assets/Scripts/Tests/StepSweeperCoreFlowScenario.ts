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
    const endTitle = findSceneObjectByName("Text-ROOM CLEARED!").getComponent("Component.Text") as Text
    expect(end.enabled).toBe(true)
    expect(endTitle.text).toBe("ROOM CLEARED!")

    await interactor.press("PlayAgain")
    expect(end.enabled).toBe(false)
    expect(hud.enabled).toBe(true)

    // The mine-loss path should create a short-lived, visible burst in
    // addition to the expanding shockwave.
    await interactor.press("HudToggleDebug")
    await interactor.press("DebugForceLoss")
    const explosionParticle = findSceneObjectByName("ExplosionParticle-0")
    expect(explosionParticle.enabled).toBe(true)
    const particleVisual = explosionParticle.getComponent("Component.RenderMeshVisual") as RenderMeshVisual
    expect(particleVisual.renderOrder).toBe(300)
    expect(particleVisual.mainMaterial.mainPass.depthTest).toBe(false)
    expect(explosionParticle.getTransform().getLocalScale().x > 1).toBe(true)
    expect(end.enabled).toBe(true)
    const explosionFlash = findSceneObjectByName("ExplosionFlash")
    expect(explosionFlash.enabled).toBe(true)
    expect(explosionFlash.getTransform().getLocalScale().x > 12).toBe(true)
    await sleep(1800)
    expect(explosionParticle.enabled).toBe(false)
  }
}
