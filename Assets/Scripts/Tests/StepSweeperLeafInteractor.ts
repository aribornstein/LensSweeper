import {DefaultLeafInteractor} from "Leaf.lspkg/Interactors/interactor/DefaultLeafInteractor"
import {findInteractablesByName} from "Leaf.lspkg/Interactors/InteractableUtils"
import {sleep} from "Leaf.lspkg/Utils/common/Utils"

export class StepSweeperLeafInteractor extends DefaultLeafInteractor {
  async press(name: string, settleMs: number = 250): Promise<void> {
    const target = findInteractablesByName(name, undefined, true)[0]
    if (!target) throw new Error(`Specs Sweeper button not found or disabled: ${name}`)
    await this.trigger(target)
    await sleep(settleMs)
  }
}
