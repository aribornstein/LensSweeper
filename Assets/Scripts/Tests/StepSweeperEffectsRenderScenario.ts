import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {ScenarioConfig} from "Leaf.lspkg/Scenarios/scenario/ScenarioConfig"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {findSceneObjectByName, sleep} from "Leaf.lspkg/Utils/common/Utils"
import {StepSweeperMain} from "../StepSweeperMain"
import {StepSweeperBoardEffects} from "../StepSweeperBoardEffects"
import {StepSweeperLeafInteractor} from "./StepSweeperLeafInteractor"
import {Button} from "SpectaclesUIKit.lspkg/Scripts/Components/Button/Button"
import {RoundedRectangleVisual} from "SpectaclesUIKit.lspkg/Scripts/Visuals/RoundedRectangle/RoundedRectangleVisual"

/** Holds two deterministic poses of the production effect for visual inspection.
 * Gameplay timing is covered separately by core-flow and flag-motion.
 */
@component
export class StepSweeperEffectsRenderScenario extends Scenario {
  async run(config?: ScenarioConfig): Promise<void> {
    const pose = config?.get("pose") ?? "sequence"
    await sleep(1500)
    const input = new StepSweeperLeafInteractor()
    await input.press("StartGame")
    await input.press("HudToggleDebug")
    await input.press("DebugMoveSouth")
    await sleep(900)
    if (pose === "win" || pose === "loss") {
      await input.press(pose === "win" ? "DebugForceWin" : "DebugForceLoss")
      await sleep(1200)
      const button = findSceneObjectByName("PlayAgain").getComponent(Button.getTypeName()) as Button
      const visual = button.visual as RoundedRectangleVisual
      // Check the rendered native state, not only the requested theme values:
      // a retained gradient previously overrode the intended cyan button.
      expect(visual.baseType).toBe("Color")
      expect(visual.baseColor.z > visual.baseColor.x + 0.1).toBe(true)
      expect(visual.hasBorder).toBe(true)
      return
    }
    await input.press("HudToggleDebug")
    const main = findSceneObjectByName("SpecsSweeper").getComponent(StepSweeperMain.getTypeName()) as StepSweeperMain
    const fixture = global.scene.createSceneObject("EffectsRenderFixture")
    fixture.setParent(findSceneObjectByName("Cell_2_2"))
    const cell = fixture.getParent()
    let clue: SceneObject | null = null
    for (let i = 0; i < cell.getChildrenCount(); i++) if (cell.getChild(i).name === "Clue") clue = cell.getChild(i)
    const clueWasEnabled = clue?.enabled ?? false
    if (clue) clue.enabled = false
    let keepFixture = false
    try {
      const effects = new StepSweeperBoardEffects(fixture, main.cellView.tileMesh, main.cellView.boundaryMaterial)
      effects.setViewer(main.cameraObject)
      effects.playBurst(new vec3(0, 0.8, 0), main.cellSizeCm, null)
      const started = getTime()
      if (pose === "mine" || pose === "burst-032" || pose === "burst-060") {
        effects.update(started + (pose === "mine" ? 0.1 : pose === "burst-032" ? 0.32 : 0.6))
        keepFixture = true
        return
      }
      effects.update(started + 0.32)
      expect(fixture.enabled).toBe(true)
      console.log("[EffectsRender] holding production burst pose at 0.32s")
      await sleep(6000)
      effects.update(started + 0.6)
      console.log("[EffectsRender] holding production burst pose at 0.60s")
      await sleep(6000)
      effects.update(started + 1.1)
      effects.clearBurst()
    } finally {
      if (!keepFixture) {
        fixture.destroy()
        if (clue) clue.enabled = clueWasEnabled
      }
    }
    // Hold the real result states too, so visual QA sees the production card.
    await input.press("HudToggleDebug")
    await input.press("DebugForceWin")
    console.log("[EffectsRender] holding victory result")
    await sleep(6000)
    await input.press("PlayAgain")
    await input.press("HudToggleDebug")
    await input.press("DebugForceLoss")
    await sleep(1200)
    console.log("[EffectsRender] holding loss result")
    await sleep(6000)
  }
}
