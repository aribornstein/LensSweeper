import {scenariosIndex} from "Leaf.lspkg/Scenarios/decorator/ScenarioIndexDecorator"
import {ScenarioMetadata} from "Leaf.lspkg/Scenarios/scenario/ScenarioMetadata"
import {StepSweeperCoreFlowScenario} from "./StepSweeperCoreFlowScenario"
import {StepSweeperReachabilityScenario} from "./StepSweeperReachabilityScenario"
import {StepSweeperProgressionScenario} from "./StepSweeperProgressionScenario"
import {StepSweeperFlagMotionScenario} from "./StepSweeperFlagMotionScenario"
import {StepSweeperEffectsRenderScenario} from "./StepSweeperEffectsRenderScenario"

@component
export class StepSweeperLeafIndex extends BaseScriptComponent {
  @scenariosIndex
  static scenariosIndex: ScenarioMetadata[] = [
    {id: "specssweeper-core-flow", typename: StepSweeperCoreFlowScenario.getTypeName()},
    {id: "specssweeper-start-reachability", typename: StepSweeperReachabilityScenario.getTypeName()},
    {id: "specssweeper-progression-placement", typename: StepSweeperProgressionScenario.getTypeName()},
    {id: "specssweeper-flag-motion", typename: StepSweeperFlagMotionScenario.getTypeName()},
    {id: "specssweeper-effects-render", typename: StepSweeperEffectsRenderScenario.getTypeName(), parameters: {pose: "sequence"}},
  ]
}
