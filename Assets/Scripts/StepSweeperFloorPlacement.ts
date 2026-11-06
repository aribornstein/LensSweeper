const WorldQueryModuleAsset = require("LensStudio:WorldQueryModule") as WorldQueryModule

export type StepSweeperPlacementResult = {
  placedOnSurface: boolean
  reason: "surface" | "preview" | "no-floor"
}

/** Places the board from a real floor hit on device, with a deterministic Preview fallback. */
export class StepSweeperFloorPlacement {
  private hitTestSession: HitTestSession | null = null
  private requestGeneration = 0

  constructor(private boardRoot: SceneObject) {}

  placeRelativeToCamera(cameraObject: SceneObject, forwardDistanceCm: number, floorOffsetCm: number): void {
    this.placeAtHeading(cameraObject, forwardDistanceCm, cameraObject.getTransform().getWorldPosition().y + floorOffsetCm)
  }

  placeAtPreviewFloor(cameraObject: SceneObject, forwardDistanceCm: number, worldFloorY: number): void {
    this.placeAtHeading(cameraObject, forwardDistanceCm, worldFloorY)
  }

  private placeAtHeading(cameraObject: SceneObject, forwardDistanceCm: number, worldFloorY: number): void {
    const cameraTransform = cameraObject.getTransform()
    const cameraPosition = cameraTransform.getWorldPosition()
    // Lens transforms call local +Z "forward", while a Camera looks along local -Z.
    const cameraForward = cameraTransform.back
    const flatForward = new vec3(cameraForward.x, 0, cameraForward.z)
    const forward = flatForward.length > 0.001 ? flatForward.normalize() : new vec3(0, 0, -1)

    this.boardRoot.getTransform().setWorldPosition(new vec3(
      cameraPosition.x + forward.x * forwardDistanceCm,
      worldFloorY,
      cameraPosition.z + forward.z * forwardDistanceCm,
    ))
    this.boardRoot.getTransform().setWorldRotation(quat.lookAt(forward, vec3.up()))
    this.boardRoot.enabled = true
  }

  recenter(
    cameraObject: SceneObject,
    forwardDistanceCm: number,
    previewFloorOffsetCm: number,
    callback: (result: StepSweeperPlacementResult) => void,
  ): void {
    const generation = ++this.requestGeneration
    if (global.deviceInfoSystem.isEditor()) {
      // Interactive scenery has a fixed floor. Camera height changes (crouching,
      // flying the editor camera, or a close-up) must not change that plane.
      this.placeAtPreviewFloor(cameraObject, forwardDistanceCm, previewFloorOffsetCm)
      callback({placedOnSurface: false, reason: "preview"})
      return
    }

    if (!this.hitTestSession) {
      const options = HitTestSessionOptions.create()
      options.filter = true
      this.hitTestSession = WorldQueryModuleAsset.createHitTestSessionWithOptions(options)
      this.hitTestSession.start()
    }
    this.tryFloorHit(cameraObject, forwardDistanceCm, generation, 0, callback)
  }

  private tryFloorHit(
    cameraObject: SceneObject,
    forwardDistanceCm: number,
    generation: number,
    attempt: number,
    callback: (result: StepSweeperPlacementResult) => void,
  ): void {
    if (!this.hitTestSession || generation !== this.requestGeneration) return
    const cameraTransform = cameraObject.getTransform()
    const rayStart = cameraTransform.getWorldPosition()
    const cameraForward = cameraTransform.back
    const flatForward = new vec3(cameraForward.x, 0, cameraForward.z)
    const forward = flatForward.length > 0.001 ? flatForward.normalize() : new vec3(0, 0, -1)
    const rayEnd = rayStart.add(forward.uniformScale(forwardDistanceCm)).add(new vec3(0, -240, 0))
    this.hitTestSession.hitTest(rayStart, rayEnd, (hit: WorldQueryHitTestResult | null) => {
      if (generation !== this.requestGeneration) return
      const normal = hit?.normal.normalize()
      if (hit && normal && normal.dot(vec3.up()) >= 0.65) {
        this.placeAtWorldFloor(hit.position, normal, forward)
        callback({placedOnSurface: true, reason: "surface"})
        return
      }
      if (attempt < 7) {
        this.tryFloorHit(cameraObject, forwardDistanceCm, generation, attempt + 1, callback)
      } else {
        callback({placedOnSurface: false, reason: "no-floor"})
      }
    })
  }

  private placeAtWorldFloor(position: vec3, normal: vec3, cameraForward: vec3): void {
    this.boardRoot.getTransform().setWorldPosition(position)
    const planarForward = cameraForward.sub(normal.uniformScale(cameraForward.dot(normal)))
    const forward = planarForward.length > 0.001 ? planarForward.normalize() : vec3.forward()
    this.boardRoot.getTransform().setWorldRotation(quat.lookAt(forward, normal))
    this.boardRoot.enabled = true
  }
}
