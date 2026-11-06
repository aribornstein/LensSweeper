type Point = [number, number, number]
type Triangle = [Point, Point, Point]
type Palette = Material[]
type EffectKind = "crystal" | "burst" | "mine" | "pole" | "ring" | "corners"

const clamp01 = (value: number): number => Math.max(0, Math.min(1, value))
const easeOut = (value: number): number => 1 - Math.pow(1 - clamp01(value), 3)

/** Shared, closed low-poly meshes, with separate face shades for unlit AR. */
class EffectGeometry {
  private static cache: {[key: string]: RenderMesh[]} = {}

  static meshes(kind: EffectKind): RenderMesh[] {
    if (this.cache[kind]) return this.cache[kind]
    const faces: Triangle[] = []
    if (kind === "crystal") {
      const rim: Point[] = [[1, 0, 0], [0, 0, 1], [-1, 0, 0], [0, 0, -1]]
      for (let i = 0; i < 4; i++) {
        faces.push([[0, 1, 0], rim[(i + 1) % 4], rim[i]])
        faces.push([[0, -1, 0], rim[i], rim[(i + 1) % 4]])
      }
    } else if (kind === "mine") {
      const point = (latitude: number, longitude: number): Point => [Math.cos(latitude) * Math.cos(longitude), Math.sin(latitude), Math.cos(latitude) * Math.sin(longitude)]
      for (let row = 0; row < 8; row++) for (let column = 0; column < 12; column++) {
        const low = -Math.PI / 2 + row * Math.PI / 8, high = low + Math.PI / 8
        const left = column * Math.PI / 6, right = left + Math.PI / 6
        const a = point(low, left), b = point(low, right), c = point(high, left), d = point(high, right)
        if (row > 0) faces.push([a, c, b])
        if (row < 7) faces.push([b, c, d])
      }
      // Six blunt studs, merged into the same three shared shade meshes.
      for (let axis = 0; axis < 3; axis++) for (const sign of [-1, 1]) {
        const center: Point = [0, 0, 0], half: Point = [0.16, 0.16, 0.16]
        center[axis] = sign
        half[axis] = 0.3
        const p = (x: number, y: number, z: number): Point => [center[0] + x * half[0], center[1] + y * half[1], center[2] + z * half[2]]
        const quads: Point[][] = [
          [p(1,-1,-1),p(1,1,-1),p(1,-1,1),p(1,1,1)],
          [p(-1,-1,1),p(-1,1,1),p(-1,-1,-1),p(-1,1,-1)],
          [p(-1,1,-1),p(-1,1,1),p(1,1,-1),p(1,1,1)],
          [p(-1,-1,1),p(-1,-1,-1),p(1,-1,1),p(1,-1,-1)],
          [p(-1,-1,1),p(1,-1,1),p(-1,1,1),p(1,1,1)],
          [p(1,-1,-1),p(-1,-1,-1),p(1,1,-1),p(-1,1,-1)],
        ]
        for (const q of quads) faces.push([q[0],q[1],q[2]], [q[2],q[1],q[3]])
      }
    } else if (kind === "corners") {
      const rectangle = (x0: number, z0: number, x1: number, z1: number): void => {
        faces.push([[x0,0,z0],[x0,0,z1],[x1,0,z0]], [[x1,0,z0],[x0,0,z1],[x1,0,z1]])
      }
      for (const x of [-1, 1]) for (const z of [-1, 1]) {
        rectangle(x < 0 ? -1 : 0.76, z - 0.012, x < 0 ? -0.76 : 1, z + 0.012)
        rectangle(x - 0.012, z < 0 ? -1 : 0.76, x + 0.012, z < 0 ? -0.76 : 1)
      }
    } else if (kind === "burst") {
      // A faceted flash with a readable silhouette, even against a bright floor.
      const rim: Point[] = []
      for (let i = 0; i < 16; i++) {
        const a = i * Math.PI / 8
        const r = i % 2 === 0 ? (i % 4 === 0 ? 1 : 0.78) : 0.36
        rim.push([Math.cos(a) * r, Math.sin(a) * r, 0])
      }
      for (let i = 0; i < rim.length; i++) {
        faces.push([[0, 0, 0.24], rim[i], rim[(i + 1) % rim.length]])
        faces.push([[0, 0, -0.16], rim[(i + 1) % rim.length], rim[i]])
      }
    } else {
      const segments = kind === "ring" ? 40 : 12
      for (let i = 0; i < segments; i++) {
        const a = i * Math.PI * 2 / segments, b = (i + 1) * Math.PI * 2 / segments
        if (kind === "ring") {
          const innerA: Point = [Math.cos(a) * 0.94, 0, Math.sin(a) * 0.94]
          const outerA: Point = [Math.cos(a), 0, Math.sin(a)]
          const innerB: Point = [Math.cos(b) * 0.94, 0, Math.sin(b) * 0.94]
          const outerB: Point = [Math.cos(b), 0, Math.sin(b)]
          faces.push([innerA, innerB, outerA], [outerA, innerB, outerB])
        } else {
          const a0: Point = [Math.cos(a), -0.5, Math.sin(a)], a1: Point = [Math.cos(a), 0.5, Math.sin(a)]
          const b0: Point = [Math.cos(b), -0.5, Math.sin(b)], b1: Point = [Math.cos(b), 0.5, Math.sin(b)]
          faces.push([a0, a1, b0], [b0, a1, b1], [[0, 0.5, 0], b1, a1], [[0, -0.5, 0], a0, b0])
        }
      }
    }
    const buckets: Triangle[][] = [[], [], []]
    for (const face of faces) {
      const a = new vec3(...face[0]), b = new vec3(...face[1]), c = new vec3(...face[2])
      const normal = b.sub(a).cross(c.sub(a)).normalize()
      const light = normal.dot(new vec3(-0.35, 0.65, 0.68))
      buckets[kind === "ring" || kind === "corners" ? 0 : light > 0.35 ? 0 : light > -0.2 ? 1 : 2].push(face)
    }
    this.cache[kind] = buckets.map(bucket => {
      const builder = new MeshBuilder([{name: "position", components: 3}, {name: "normal", components: 3}, {name: "texture0", components: 2}])
      builder.topology = MeshTopology.Triangles
      builder.indexType = MeshIndexType.UInt16
      for (const face of bucket) {
        const a = new vec3(...face[0]), b = new vec3(...face[1]), c = new vec3(...face[2])
        const n = b.sub(a).cross(c.sub(a)).normalize()
        const index = builder.getVerticesCount()
        for (const p of face) builder.appendVerticesInterleaved([...p, n.x, n.y, n.z, 0.5, 0.5])
        builder.appendIndices([index, index + 1, index + 2])
      }
      if (bucket.length > 0) builder.updateMesh()
      return builder.getMesh()
    })
    return this.cache[kind]
  }
}

/** Fixed topology; only the cloth vertices move. The mast seam stays pinned. */
class FlagCloth {
  readonly root: SceneObject
  private tip: SceneObject
  private builders: MeshBuilder[] = []
  private vertices: [number, number][][] = []
  private lastUpdate = -1

  constructor(parent: SceneObject, effects: StepSweeperBoardEffects) {
    this.root = effects.object("FlagPennant", parent)
    this.root.getTransform().setLocalPosition(new vec3(0, 31.5, 0))
    this.tip = effects.object("FlagClothTip", this.root)
    for (let side = 0; side < 2; side++) {
      const samples: [number, number][] = []
      for (let column = 0; column < 12; column++) {
        const a = column / 12, b = (column + 1) / 12
        for (let row = 0; row < 2; row++) {
          const c = row / 2, d = (row + 1) / 2
          const triangles: [number, number][][] = [[[a, c], [b, c], [a, d]], [[a, d], [b, c], [b, d]]]
          for (const triangle of triangles) samples.push(...(side === 0 ? triangle : triangle.slice().reverse()))
        }
      }
      const builder = new MeshBuilder([{name: "position", components: 3}, {name: "normal", components: 3}, {name: "texture0", components: 2}])
      builder.topology = MeshTopology.Triangles
      builder.indexType = MeshIndexType.UInt16
      for (let i = 0; i < samples.length; i++) {
        builder.appendVerticesInterleaved([0, 0, 0, 0, 0, side === 0 ? 1 : -1, 0, 0])
        builder.appendIndices([i])
      }
      const visual = effects.object(`Cloth-${side === 0 ? "Front" : "Back"}`, this.root).createComponent("Component.RenderMeshVisual") as RenderMeshVisual
      visual.mesh = builder.getMesh()
      visual.mainMaterial = effects.red[side === 0 ? 0 : 1]
      this.builders.push(builder)
      this.vertices.push(samples)
    }
    this.update(getTime())
  }

  private point(u: number, v: number, now: number): vec3 {
    const phase = u * 7.5 - now * 5.2
    const wave = (Math.sin(phase) + Math.sin(u * 12 - now * 7.8) * 0.24) * u
    return new vec3(18 * u, -6 + (0.5 - v) * 12 * (1 - u) + Math.sin(phase + 0.8) * u * 0.65, wave * 2.8)
  }

  update(now: number): void {
    if (now - this.lastUpdate < 1 / 30) return
    this.lastUpdate = now
    for (let side = 0; side < this.builders.length; side++) {
      const builder = this.builders[side], samples = this.vertices[side]
      for (let i = 0; i < samples.length; i += 3) {
        const points = samples.slice(i, i + 3).map(uv => this.point(uv[0], uv[1], now))
        const cross = points[1].sub(points[0]).cross(points[2].sub(points[0]))
        const n = cross.lengthSquared > 0.00001 ? cross.normalize() : new vec3(0, 0, side === 0 ? 1 : -1)
        for (let j = 0; j < 3; j++) {
          const p = points[j], uv = samples[i + j]
          builder.setVertexInterleaved(i + j, [p.x, p.y, p.z, n.x, n.y, n.z, uv[0], uv[1]])
        }
      }
      builder.updateMesh()
    }
    this.tip.getTransform().setLocalPosition(this.point(1, 0.5, now))
  }
}

export class StepSweeperFlagVisual {
  readonly root: SceneObject
  private rig: SceneObject
  private pennant: SceneObject
  private cloth: FlagCloth
  private ring: SceneObject
  private ringMaterial: Material
  private target = false
  private amount = 0
  private from = 0
  private startedAt = 0

  constructor(parent: SceneObject, name: string, effects: StepSweeperBoardEffects) {
    this.root = effects.object(name, parent)
    this.root.getTransform().setLocalPosition(new vec3(0, 4.7, 0))
    this.root.getTransform().setLocalRotation(quat.angleAxis(Math.PI, vec3.up()))
    effects.shape("FlagBase", this.root, "pole", effects.cyan, new vec3(0, 0.5, 0), new vec3(2.1, 1, 2.1))
    this.rig = effects.object("FlagRig", this.root)
    effects.shape("FlagPole", this.rig, "pole", effects.pale, new vec3(0, 16, 0), new vec3(0.48, 32, 0.48))
    effects.shape("FlagTip", this.rig, "crystal", effects.coral, new vec3(0, 33, 0), new vec3(0.9, 0.9, 0.9))
    this.cloth = new FlagCloth(this.rig, effects)
    this.pennant = this.cloth.root
    this.ringMaterial = effects.fadeMaterial(new vec4(0.2, 0.85, 1, 1))
    this.ring = effects.shape("FlagConfirmRing", this.root, "ring", [this.ringMaterial], vec3.zero(), vec3.one())
    this.root.enabled = false
  }

  set(active: boolean, animate: boolean): void {
    if (!animate) {
      this.target = active
      this.amount = active ? 1 : 0
      this.from = this.amount
      this.startedAt = getTime() - 2
      this.update(getTime())
      return
    }
    if (this.target === active) return
    this.from = this.amount
    this.target = active
    this.startedAt = getTime()
    this.root.enabled = true
  }

  update(now: number): void {
    const elapsed = now - this.startedAt
    const t = clamp01(elapsed / (this.target ? 0.5 : 0.22))
    this.amount = this.from + ((this.target ? 1 : 0) - this.from) * easeOut(t)
    this.root.enabled = this.target || this.amount > 0.001
    if (!this.root.enabled) return
    this.rig.getTransform().setLocalScale(new vec3(1, Math.max(0.001, this.amount), 1))
    const unfold = clamp01((this.amount - 0.25) / 0.75)
    const overshoot = this.target ? Math.sin(t * Math.PI) * (1 - t) * 0.24 : 0
    this.pennant.getTransform().setLocalScale(new vec3(Math.max(0.015, unfold + overshoot), 1, 1))
    this.cloth.update(now)
    const ringT = clamp01((elapsed - 0.18) / 0.4)
    this.ring.enabled = this.target && ringT > 0 && ringT < 1
    this.ring.getTransform().setLocalScale(new vec3(2 + ringT * 9, 1, 2 + ringT * 9))
    this.ringMaterial.mainPass.baseColor = new vec4(0.2, 0.85, 1, 1 - ringT)
  }
}

/** One reusable board-local burst, plus flag state machines and shared meshes. */
export class StepSweeperBoardEffects {
  readonly red: Palette
  readonly coral: Palette
  readonly pale: Palette
  readonly cyan: Palette
  private cream: Palette
  private flags: StepSweeperFlagVisual[] = []
  private burstRoot: SceneObject
  private core: SceneObject
  private hotCore: SceneObject
  private ring: SceneObject
  private ringMaterial: Material
  private warning: SceneObject
  private warningMaterial: Material
  private mineMarkerMaterial: Material
  private victoryRing: SceneObject
  private victoryMaterial: Material
  private victoryStartedAt = -1
  private victoryRadius = 1
  private viewer: SceneObject | null = null
  private fragments: SceneObject[] = []
  private sparks: SceneObject[] = []
  private hitMarker: SceneObject
  private startedAt = -1
  private cellSize = 50

  constructor(owner: SceneObject, boxMesh: RenderMesh, private template: Material) {
    this.red = this.palette(new vec4(1, 0.12, 0.09, 1))
    this.coral = this.palette(new vec4(1, 0.3, 0.17, 1))
    this.pale = this.palette(new vec4(0.95, 0.94, 0.83, 1))
    this.cyan = this.palette(new vec4(0.2, 0.85, 1, 1))
    this.cream = this.palette(new vec4(1, 0.83, 0.46, 1))
    this.burstRoot = this.object("MineBurst", owner)
    this.core = this.shape("BurstMine", this.burstRoot, "mine", this.coral, new vec3(0, 13, 0), new vec3(8, 8, 8))
    this.shape("MineEquator", this.core, "ring", this.pale, vec3.zero(), new vec3(1.055, 1, 1.055))
    this.hotCore = this.shape("BurstHotCore", this.burstRoot, "burst", this.cream, new vec3(0, 14, 0), vec3.one())
    this.ringMaterial = this.fadeMaterial(new vec4(1, 0.3, 0.17, 1))
    this.ring = this.shape("MineShockwave", this.burstRoot, "ring", [this.ringMaterial], new vec3(0, 0.2, 0), vec3.one())
    this.warningMaterial = this.fadeMaterial(new vec4(1, 0.4, 0.28, 1))
    this.warning = this.shape("MineWarningCorners", this.burstRoot, "corners", [this.warningMaterial], new vec3(0, 0.1, 0), vec3.one())
    this.mineMarkerMaterial = this.fadeMaterial(new vec4(1, 0.4, 0.28, 0.75))
    this.victoryMaterial = this.fadeMaterial(new vec4(0.2, 1, 0.7, 1))
    this.victoryRing = this.shape("VictorySweep", owner, "ring", [this.victoryMaterial], new vec3(0, 5, 0), vec3.one())
    for (let i = 0; i < 8; i++) this.fragments.push(this.shape(`ExplosionParticle-${i}`, this.burstRoot, "crystal", i % 4 === 0 ? this.cream : this.coral, vec3.zero(), vec3.one()))
    for (let i = 0; i < 4; i++) this.sparks.push(this.shape(`MineSpark-${i}`, this.burstRoot, "crystal", this.cream, vec3.zero(), vec3.one()))
    this.hitMarker = this.object("MineHitMarker", this.burstRoot)
    this.shape("MineImpactCircle", this.hitMarker, "ring", this.coral, new vec3(0, 0.3, 0), new vec3(6.5, 1, 6.5))
    for (const angle of [-Math.PI / 4, Math.PI / 4]) {
      const bar = this.object("HitCrossBar", this.hitMarker)
      const visual = bar.createComponent("Component.RenderMeshVisual") as RenderMeshVisual
      visual.mesh = boxMesh
      visual.mainMaterial = this.coral[0]
      bar.getTransform().setLocalPosition(new vec3(0, 0.6, 0))
      bar.getTransform().setLocalScale(new vec3(8.5, 0.25, 0.8))
      bar.getTransform().setLocalRotation(quat.angleAxis(angle, vec3.up()))
    }
    this.clearBurst()
  }

  createFlag(parent: SceneObject, name: string): StepSweeperFlagVisual {
    const flag = new StepSweeperFlagVisual(parent, name, this)
    this.flags.push(flag)
    return flag
  }

  createMine(parent: SceneObject): SceneObject {
    return this.shape("MineLocation", parent, "ring", [this.mineMarkerMaterial], new vec3(0, 0.5, 0), new vec3(2.2, 1, 2.2))
  }

  setViewer(viewer: SceneObject): void { this.viewer = viewer }

  playVictory(width: number, depth: number): void {
    this.victoryRadius = Math.sqrt(width * width + depth * depth) * 0.55
    this.victoryStartedAt = getTime()
    this.victoryRing.enabled = true
  }

  playBurst(center: vec3, cellSize: number, mine: SceneObject | null): void {
    this.clearBurst()
    this.cellSize = cellSize
    this.burstRoot.getTransform().setLocalPosition(center)
    this.burstRoot.enabled = true
    if (mine) mine.enabled = false
    this.startedAt = getTime()
    this.update(this.startedAt)
  }

  update(now: number): void {
    for (const flag of this.flags) flag.update(now)
    if (this.victoryStartedAt >= 0) {
      const progress = clamp01((now - this.victoryStartedAt) / 0.95)
      const radius = 5 + easeOut(progress) * this.victoryRadius
      this.victoryRing.getTransform().setLocalScale(new vec3(radius, 1, radius))
      this.victoryMaterial.mainPass.baseColor = new vec4(0.2, 1, 0.7, (1 - progress) * 0.9)
      if (progress >= 1) { this.victoryRing.enabled = false; this.victoryStartedAt = -1 }
    }
    if (this.startedAt < 0) return
    const t = now - this.startedAt
    this.warning.enabled = t < 0.6
    this.warning.getTransform().setLocalScale(new vec3(this.cellSize * 0.45, 1, this.cellSize * 0.45))
    this.warningMaterial.mainPass.baseColor = new vec4(1, 0.4, 0.28, 1 - clamp01((t - 0.25) / 0.35))
    this.core.enabled = t < 0.2
    const squash = clamp01(t / 0.2)
    this.core.getTransform().setLocalScale(new vec3(8 + squash, 8 - squash * 3, 8 + squash))
    const flash = clamp01((t - 0.17) / 0.23)
    this.hotCore.enabled = t >= 0.17 && t < 0.4
    this.hotCore.getTransform().setLocalScale(vec3.one().uniformScale(1 + Math.sin(flash * Math.PI) * 12))
    if (this.viewer && this.hotCore.enabled) {
      const direction = this.viewer.getTransform().getWorldPosition().sub(this.hotCore.getTransform().getWorldPosition())
      if (direction.lengthSquared > 0.001) {
        const up = Math.abs(direction.normalize().dot(vec3.up())) > 0.98 ? vec3.forward() : vec3.up()
        this.hotCore.getTransform().setWorldRotation(quat.lookAt(direction, up))
      }
    }
    const ringT = clamp01((t - 0.3) / 0.65)
    this.ring.enabled = t >= 0.3 && ringT < 1
    const radius = 3 + easeOut(ringT) * this.cellSize * 0.85
    this.ring.getTransform().setLocalScale(new vec3(radius, 1, radius))
    this.ringMaterial.mainPass.baseColor = new vec4(1, 0.3, 0.17, (1 - ringT) * 0.9)
    for (let i = 0; i < this.fragments.length; i++) {
      const object = this.fragments[i]
      const age = Math.max(0, t - 0.2)
      const progress = clamp01(age / (0.62 + (i % 3) * 0.06))
      object.enabled = t >= 0.2 && progress < 1
      const angle = i * Math.PI / 4 + 0.2
      const speed = this.cellSize * (1.1 + (i % 3) * 0.12)
      object.getTransform().setLocalPosition(new vec3(Math.cos(angle) * speed * age, Math.max(2, 13 + (65 + i % 3 * 8) * age - 100 * age * age), Math.sin(angle) * speed * age))
      object.getTransform().setLocalScale(new vec3(2.4, 5.5, 2.4).uniformScale(1 - progress * progress))
      object.getTransform().setLocalRotation(quat.fromEulerAngles(age * 5, angle + age * 3, age * 4))
    }
    for (let i = 0; i < this.sparks.length; i++) {
      const age = Math.max(0, t - 0.2), progress = clamp01(age / 0.32)
      const angle = i * Math.PI / 2 + 0.55
      const spark = this.sparks[i]
      spark.enabled = t >= 0.2 && progress < 1
      spark.getTransform().setLocalPosition(new vec3(Math.cos(angle) * age * 90, 10 + age * 85, Math.sin(angle) * age * 90))
      spark.getTransform().setLocalScale(new vec3(0.8, 3.5, 0.8).uniformScale(1 - progress))
    }
    this.hitMarker.enabled = t >= 0.65
    if (t >= 1.1) this.startedAt = -1
  }

  clearBurst(): void {
    this.startedAt = -1
    this.victoryStartedAt = -1
    this.victoryRing.enabled = false
    this.burstRoot.enabled = false
    for (const object of [this.core, this.hotCore, this.ring, this.warning, this.hitMarker, ...this.fragments, ...this.sparks]) object.enabled = false
  }

  clearBoard(): void { this.clearBurst(); this.flags = [] }

  object(name: string, parent: SceneObject): SceneObject {
    const object = global.scene.createSceneObject(name)
    object.setParent(parent)
    return object
  }

  shape(name: string, parent: SceneObject, kind: EffectKind, palette: Palette, position: vec3, scale: vec3): SceneObject {
    const object = this.object(name, parent)
    object.getTransform().setLocalPosition(position)
    object.getTransform().setLocalScale(scale)
    EffectGeometry.meshes(kind).forEach((mesh, i) => {
      // Rings use only the upward-facing bucket.
      if ((kind === "ring" || kind === "corners") && i > 0) return
      const facet = this.object(`${name}-Facet-${i}`, object)
      const visual = facet.createComponent("Component.RenderMeshVisual") as RenderMeshVisual
      visual.mesh = mesh
      visual.mainMaterial = palette[Math.min(i, palette.length - 1)]
      visual.renderOrder = 120
    })
    return object
  }

  fadeMaterial(color: vec4): Material {
    const material = this.template.clone()
    material.mainPass.baseColor = color
    material.mainPass.blendMode = BlendMode.Normal
    material.mainPass.depthTest = true
    material.mainPass.depthWrite = false
    return material
  }

  private palette(color: vec4): Palette {
    return [1, 0.76, 0.5].map(shade => {
      const material = this.template.clone()
      material.mainPass.baseColor = new vec4(color.x * shade, color.y * shade, color.z * shade, 1)
      material.mainPass.blendMode = BlendMode.Disabled
      material.mainPass.depthTest = true
      material.mainPass.depthWrite = true
      return material
    })
  }
}
