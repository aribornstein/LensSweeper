import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {findSceneObjectByName, sleep} from "Leaf.lspkg/Utils/common/Utils"
import {StepSweeperLeafInteractor} from "./StepSweeperLeafInteractor"

@component
export class StepSweeperFlagMotionScenario extends Scenario {
  async run(): Promise<void> {
    await sleep(1500)
    const input = new StepSweeperLeafInteractor()
    await input.press("StartGame")
    // Reverse deployment before it completes, then reverse retraction.
    await input.press("Cell_5_5", 40)
    await input.press("Cell_5_5", 40)
    await input.press("Cell_5_5", 40)
    await sleep(600)
    const flag = findSceneObjectByName("RedFlag_5_5")
    expect(flag.enabled).toBe(true)
    const rig = flag.getChild(1)
    expect(Math.abs(rig.getTransform().getLocalScale().y - 1) < 0.01).toBe(true)
    const pennant = rig.getChild(2)
    const tip = pennant.getChild(0)
    const tipBefore = tip.getTransform().getLocalPosition()
    const seamBefore = pennant.getTransform().getLocalPosition()
    const poleBefore = rig.getChild(0).getTransform().getLocalPosition()
    await sleep(300)
    expect(tip.getTransform().getLocalPosition().sub(tipBefore).length > 0.15).toBe(true)
    expect(pennant.getTransform().getLocalPosition().sub(seamBefore).length < 0.001).toBe(true)
    expect(rig.getChild(0).getTransform().getLocalPosition().sub(poleBefore).length < 0.001).toBe(true)
    await input.press("Cell_5_5")
    expect(flag.enabled).toBe(false)
    await input.press("Cell_5_5", 40)
    await input.press("Restart")
    expect(flag.enabled).toBe(false)

    // Restart during a burst must cancel the pending result card.
    await input.press("HudToggleDebug")
    await input.press("DebugForceLoss", 100)
    expect(findSceneObjectByName("MineBurst").enabled).toBe(true)
    await input.press("Restart")
    await sleep(800)
    expect(findSceneObjectByName("MineBurst").enabled).toBe(false)
    expect(findSceneObjectByName("SpecsSweeperEnd").enabled).toBe(false)

    // Leave a real, normally revealed board and a planted flag for inspection.
    await input.press("HudToggleDebug")
    await input.press("DebugMoveSouth")
    await sleep(900)
    await input.press("Cell_5_5")
    await sleep(600)
    expect(flag.enabled).toBe(true)
    await input.press("HudToggleDebug")
  }
}
