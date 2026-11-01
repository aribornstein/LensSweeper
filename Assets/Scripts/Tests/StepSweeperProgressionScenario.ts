import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {findSceneObjectByName, sleep} from "Leaf.lspkg/Utils/common/Utils"
import {StepSweeperLeafInteractor} from "./StepSweeperLeafInteractor"
import {STEP_SWEEPER_DIFFICULTIES, StepSweeperProgress} from "../StepSweeperProgress"

@component
export class StepSweeperProgressionScenario extends Scenario {
  async run(): Promise<void> {
    this.verifyPersistentProgress()
    await sleep(1500)
    const interactor = new StepSweeperLeafInteractor()
    const counts: number[] = [this.cellCount()]

    // Cycling all three modes must rebuild rather than duplicate the board,
    // and must return to the starting preset after a complete cycle.
    for (let i = 0; i < 3; i++) {
      await interactor.press("IntroCycleDifficulty")
      counts.push(this.cellCount())
    }
    expect(counts[3]).toBe(counts[0])
    expect(counts.slice(0, 3).indexOf(25) >= 0).toBe(true)
    expect(counts.slice(0, 3).indexOf(36) >= 0).toBe(true)
    expect(counts.slice(0, 3).indexOf(49) >= 0).toBe(true)

    await interactor.press("StartGame")
    await interactor.press("HudRecenter")
    const placement = findSceneObjectByName("Text-PLACEMENT READY").getComponent("Component.Text") as Text
    expect(placement.text).toBe("PREVIEW PLACEMENT")
  }

  private verifyPersistentProgress(): void {
    const store = global.persistentStorageSystem.store
    const bestKey = "step_sweeper.best.EASY"
    const winsKey = "step_sweeper.wins.EASY"
    const hadBest = store.has(bestKey)
    const hadWins = store.has(winsKey)
    const savedBest = hadBest ? store.getInt(bestKey) : 0
    const savedWins = hadWins ? store.getInt(winsKey) : 0
    store.remove(bestKey)
    store.remove(winsKey)

    const result = new StepSweeperProgress().recordWin(STEP_SWEEPER_DIFFICULTIES[0], 73, 18)
    expect(result.bestSeconds).toBe(73)
    expect(result.isNewBest).toBe(true)
    expect(result.wins).toBe(1)
    expect(result.score > 0).toBe(true)

    if (hadBest) store.putInt(bestKey, savedBest)
    else store.remove(bestKey)
    if (hadWins) store.putInt(winsKey, savedWins)
    else store.remove(winsKey)
  }

  private cellCount(): number {
    const root = findSceneObjectByName("BoardContent")
    let count = 0
    for (let i = 0; i < root.getChildrenCount(); i++) {
      if (root.getChild(i).name.indexOf("Cell_") === 0) count++
    }
    return count
  }
}
