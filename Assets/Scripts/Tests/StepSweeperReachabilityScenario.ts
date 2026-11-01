import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {findSceneObjectByName, sleep} from "Leaf.lspkg/Utils/common/Utils"
import {StepSweeperLeafInteractor} from "./StepSweeperLeafInteractor"

@component
export class StepSweeperReachabilityScenario extends Scenario {
  async run(): Promise<void> {
    await sleep(1500)
    const interactor = new StepSweeperLeafInteractor()
    await interactor.press("StartGame")
    expect(findSceneObjectByName("SpecsSweeperHUD").enabled).toBe(true)
  }
}
