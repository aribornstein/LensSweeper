const CLUE_MATERIAL = requireAsset("../Materials/StepSweeperSpatialClue.mat") as Material

/** A floor-anchored, genuinely extruded numeral that faces the tracked viewer. */
export class StepSweeperSpatialClue {
  readonly root: SceneObject
  private face: SceneObject
  private numeral: Text3D
  private stem: SceneObject
  private anchor: SceneObject
  private zero: SceneObject
  private value = -1
  private static materials: Material[] = []
  private static markers: Material[] = []
  private static ringMesh: RenderMesh | null = null

  constructor(parent: SceneObject, boxMesh: RenderMesh, markerTemplate: Material, cellSize: number) {
    this.root = global.scene.createSceneObject("Clue")
    this.root.setParent(parent)
    this.face = global.scene.createSceneObject("SpatialNumeral")
    this.face.setParent(this.root)
    this.face.getTransform().setLocalPosition(new vec3(0, 27, 0))
    const glyph = global.scene.createSceneObject("ExtrudedDigit")
    glyph.setParent(this.face)
    this.numeral = glyph.createComponent("Component.Text3D") as Text3D
    this.numeral.size = 800
    this.numeral.weight = 800
    this.numeral.extrusionDepth = 0.2
    this.numeral.extrudeDirection = Text3DExtrudeDirection.Backwards
    this.numeral.horizontalAlignment = HorizontalAlignment.Center
    this.numeral.verticalAlignment = VerticalAlignment.Center
    this.numeral.layoutRect = Rect.create(-20, 20, -20, 20)
    this.numeral.renderOrder = 120
    // Font em units differ from cap height; scale once per board preset.
    glyph.getTransform().setLocalScale(vec3.one().uniformScale(cellSize / 32))
    // A small sculptural bias exposes the side wall even when the parent is
    // facing the viewer exactly. It stays readable while showing actual depth.
    glyph.getTransform().setLocalRotation(quat.fromEulerAngles(0.06, -0.14, 0))
    this.stem = this.meshObject("ClueStem", boxMesh)
    this.stem.getTransform().setLocalPosition(new vec3(0, 12, 0))
    this.stem.getTransform().setLocalScale(new vec3(0.45, 15, 0.45))
    this.anchor = this.meshObject("ClueAnchor", StepSweeperSpatialClue.ring())
    this.anchor.getTransform().setLocalPosition(new vec3(0, 4.6, 0))
    this.anchor.getTransform().setLocalScale(new vec3(3, 1, 3))
    this.zero = this.meshObject("ClearTileDot", StepSweeperSpatialClue.ring())
    this.zero.getTransform().setLocalPosition(new vec3(0, 4.6, 0))
    this.zero.getTransform().setLocalScale(new vec3(1.3, 1, 1.3))
    this.setValue(0, markerTemplate)
    this.root.enabled = false
  }

  get enabled(): boolean { return this.root.enabled }
  set enabled(value: boolean) { this.root.enabled = value }

  /** Lift the digit itself; its anchor stays attached to the real floor. */
  setRevealProgress(progress: number): void {
    const t = Math.max(0, Math.min(1, progress))
    const eased = 1 - Math.pow(1 - t, 3)
    this.face.enabled = this.value > 0 && t > 0
    this.face.getTransform().setLocalPosition(new vec3(0, 5 + 22 * eased, 0))
    this.face.getTransform().setLocalScale(vec3.one().uniformScale(0.82 + 0.18 * eased))
    this.stem.enabled = this.value > 0 && t > 0
    this.stem.getTransform().setLocalPosition(new vec3(0, 4.5 + 7.5 * eased, 0))
    this.stem.getTransform().setLocalScale(new vec3(0.45, Math.max(0.01, 15 * eased), 0.45))
    this.anchor.enabled = this.value > 0 && t > 0
    this.zero.enabled = this.value === 0 && t > 0.2
  }

  setValue(value: number, markerTemplate: Material): void {
    if (this.value === value) return
    this.value = value
    const color = value === 0 ? new vec4(0.25, 1, 0.7, 1)
      : value === 1 ? new vec4(0.2, 0.85, 1, 1)
      : value === 2 ? new vec4(1, 0.85, 0.15, 1) : new vec4(1, 0.3, 0.15, 1)
    if (!StepSweeperSpatialClue.materials[value]) {
      const material = CLUE_MATERIAL.clone()
      const pass = material.mainPass
      pass.depthTest = true
      pass.depthWrite = true
      // Text3D's shader has separate cap/edge colors: depth stays visible
      // without expensive lighting or environment-dependent reflections.
      for (const region of ["frontCap", "backCap", "outerEdge", "InnerEdge"]) {
        const shade = region === "frontCap" ? 1 : region === "backCap" ? 0.5 : 0.62
        pass[region + "StartingColor"] = new vec4(color.x * shade, color.y * shade, color.z * shade, 1)
        pass[region + "EndingColor"] = new vec4(color.x * shade * 0.9, color.y * shade * 0.9, color.z * shade * 0.9, 1)
      }
      StepSweeperSpatialClue.materials[value] = material
      const marker = markerTemplate.clone()
      marker.mainPass.baseColor = color
      marker.mainPass.depthTest = true
      marker.mainPass.depthWrite = true
      StepSweeperSpatialClue.markers[value] = marker
    }
    this.numeral.mainMaterial = StepSweeperSpatialClue.materials[value]
    this.numeral.text = value > 0 ? String(value) : ""
    for (const object of [this.stem, this.anchor, this.zero]) {
      (object.getComponent("Component.RenderMeshVisual") as RenderMeshVisual).mainMaterial = StepSweeperSpatialClue.markers[value]
    }
    this.face.enabled = value > 0
    this.stem.enabled = value > 0
    this.anchor.enabled = value > 0
    this.zero.enabled = value === 0
  }

  faceViewer(cameraPosition: vec3): void {
    if (!this.enabled || this.value <= 0) return
    const transform = this.face.getTransform()
    const direction = cameraPosition.sub(transform.getWorldPosition())
    if (direction.lengthSquared < 0.0001) return
    const forward = direction.normalize()
    // Underfoot clues need a stable up vector even when looking straight down.
    const up = Math.abs(forward.dot(vec3.up())) > 0.98 ? vec3.forward() : vec3.up()
    transform.setWorldRotation(quat.lookAt(forward, up))
  }

  private meshObject(name: string, mesh: RenderMesh): SceneObject {
    const object = global.scene.createSceneObject(name)
    object.setParent(this.root)
    const visual = object.createComponent("Component.RenderMeshVisual") as RenderMeshVisual
    visual.mesh = mesh
    return object
  }

  private static ring(): RenderMesh {
    if (this.ringMesh) return this.ringMesh
    const builder = new MeshBuilder([{name: "position", components: 3}, {name: "normal", components: 3}, {name: "texture0", components: 2}])
    builder.topology = MeshTopology.Triangles
    builder.indexType = MeshIndexType.UInt16
    for (let i = 0; i <= 24; i++) {
      const angle = i * Math.PI * 2 / 24
      for (const radius of [0.77, 1]) {
        const x = Math.cos(angle) * radius, z = Math.sin(angle) * radius
        builder.appendVerticesInterleaved([x, 0, z, 0, 1, 0, x * 0.5 + 0.5, z * 0.5 + 0.5])
      }
      if (i < 24) {
        const a = i * 2
        builder.appendIndices([a, a + 2, a + 1, a + 1, a + 2, a + 3])
      }
    }
    builder.updateMesh()
    this.ringMesh = builder.getMesh()
    return this.ringMesh
  }
}
