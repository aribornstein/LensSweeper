type ArenaPoint = [number, number, number]
type ArenaProfile = [number, number]

/** Merged world-space arena trim. All dimensions are cm, relative to the floor. */
export class StepSweeperArena {
  readonly root: SceneObject
  private builders: MeshBuilder[] = []
  private materials: Material[] = []

  constructor(parent: SceneObject, template: Material, width: number, depth: number, cellSize: number) {
    this.root = global.scene.createSceneObject("ArenaArchitecture")
    this.root.setParent(parent)
    const colors = [
      new vec4(0.25, 0.38, 0.43, 1), new vec4(0.14, 0.23, 0.28, 1), new vec4(0.07, 0.13, 0.18, 1),
      new vec4(0.16, 0.95, 1, 1), new vec4(0.75, 1, 1, 1),
      new vec4(0.05, 0.8, 1, 0.15), new vec4(0.04, 0.6, 0.8, 0.095),
    ]
    for (let i = 0; i < colors.length; i++) {
      const material = template.clone()
      material.mainPass.baseColor = colors[i]
      material.mainPass.blendMode = i < 5 ? BlendMode.Disabled : BlendMode.Normal
      material.mainPass.depthTest = true
      material.mainPass.depthWrite = i < 5
      this.materials.push(material)
      const builder = new MeshBuilder([{name:"position", components:3}, {name:"normal", components:3}, {name:"texture0", components:2}])
      builder.topology = MeshTopology.Triangles
      builder.indexType = MeshIndexType.UInt16
      this.builders.push(builder)
    }
    const x = width / 2 + 3, z = depth / 2 + 3
    // The continuous outline is separate from the grid, with no slab under it.
    this.floorRing(x, z, 8, 0.7, 0.35, 3)
    this.floorRing(x, z, 8, 5, 0.25, 5)
    this.floorRect(-width/2, -depth/2, width/2, depth/2, 0.12, 6)
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) this.cornerPost(sx * x, sz * z)
    // Low luminous barriers terminate inside the corner posts. They are visual
    // trim only: no colliders, physics bodies, or changes to playable cells.
    for (const side of [-1, 1]) {
      this.box(-x + 5, 15, side*z - 0.6, x - 5, 16.2, side*z + 0.6, 3)
      this.box(side*x - 0.6, 15, -z + 5, side*x + 0.6, 16.2, z - 5, 3)
      this.box(-x + 5, 15.45, side*z - 0.22, x - 5, 15.85, side*z + 0.22, 4)
      this.box(side*x - 0.22, 15.45, -z + 5, side*x + 0.22, 15.85, z - 5, 4)
      this.box(-x + 5, 13.8, side*z - 1.3, x - 5, 17.4, side*z + 1.3, 5)
      this.box(side*x - 1.3, 13.8, -z + 5, side*x + 1.3, 17.4, z - 5, 5)
      // Repeated small brackets express scale without filling the field.
      for (let c = 1; c < Math.round(width / cellSize); c++) {
        const px = -width/2 + c * cellSize
        this.box(px - 1.2, 0.4, side*z - 1.5, px + 1.2, 1, side*z + 1.5, 4)
      }
    }
    this.console(width/2 + 43, -depth/2 + 78, 38, 17)
    this.console(-width/2 - 38, -depth/2 + 78, 33, 16)
    const names = ["ArenaShellLight", "ArenaShellMid", "ArenaShellDark", "ArenaCyanTrim", "ArenaWhiteHighlights", "ArenaLightHalo", "ArenaFloorTint"]
    for (let i = 0; i < this.builders.length; i++) {
      const builder = this.builders[i]
      if (builder.getIndicesCount() === 0) continue
      builder.updateMesh()
      const object = global.scene.createSceneObject(names[i])
      object.setParent(this.root)
      const visual = object.createComponent("Component.RenderMeshVisual") as RenderMeshVisual
      visual.mesh = builder.getMesh()
      visual.mainMaterial = this.materials[i]
      // Draw the world trim before translucent UIKit panels. Drawing it after
      // the glass can overwrite labels because those panels don't write depth.
      visual.renderOrder = i < 5 ? -30 : -20
    }
  }

  private cornerPost(x: number, z: number): void {
    this.lathe(x, z, [[9,0.3],[9,2],[7,4],[5,4.5],[5,23],[6.4,24],[6.4,26.5],[5.2,28]], -1)
    this.lathe(x, z, [[5.06,6],[5.06,7.1]], 3)
    this.lathe(x, z, [[6.48,24.4],[6.48,25.5]], 3)
    this.lathe(x, z, [[3.7,28.05],[3.7,28.45]], 3)
    this.lathe(x, z, [[1.3,28.5],[1.3,28.8]], 4)
    for (const sx of [-1, 1]) this.box(x + sx*3.8 - 0.45, 8, z - 3.3, x + sx*3.8 + 0.45, 21, z + 3.3, 3)
    this.floorRingAt(x, z, 10, 1.5, 0.2, 5)
  }

  private console(x: number, z: number, halfWidth: number, top: number): void {
    this.bevelBox(x, z, halfWidth, 12, 0.25, 4, 4, -1)
    this.bevelBox(x, z, halfWidth - 2, 10, 4, 5, 3, 3)
    this.lathe(x, z, [[7,5.1],[6,7],[6,top-2],[9,top]], -1)
    this.lathe(x, z, [[6.1,8],[6.1,9]], 3)
  }

  private triangle(a: ArenaPoint, b: ArenaPoint, c: ArenaPoint, group: number): void {
    const normal = new vec3(b[0]-a[0], b[1]-a[1], b[2]-a[2]).cross(new vec3(c[0]-a[0], c[1]-a[1], c[2]-a[2]))
    if (normal.lengthSquared < 0.000001) return
    const n = normal.normalize()
    const light = n.dot(new vec3(-0.35, 0.8, 0.45))
    const builder = this.builders[group < 0 ? (light > 0.35 ? 0 : light > -0.25 ? 1 : 2) : group]
    const first = builder.getVerticesCount()
    for (const p of [a,b,c]) builder.appendVerticesInterleaved([p[0],p[1],p[2],n.x,n.y,n.z,0,0])
    builder.appendIndices([first,first+1,first+2])
  }

  private quad(a: ArenaPoint, b: ArenaPoint, c: ArenaPoint, d: ArenaPoint, group: number): void {
    this.triangle(a,b,c,group)
    this.triangle(a,c,d,group)
  }

  private lathe(x: number, z: number, profile: ArenaProfile[], group: number): void {
    const segments = 12
    const point = (r:number,y:number,a:number): ArenaPoint => [x+Math.cos(a)*r,y,z+Math.sin(a)*r]
    for (let s=0;s<segments;s++) {
      const a=s*Math.PI*2/segments, b=(s+1)*Math.PI*2/segments
      for (let p=0;p<profile.length-1;p++) {
        const [r0,y0]=profile[p], [r1,y1]=profile[p+1]
        this.quad(point(r0,y0,a),point(r1,y1,a),point(r1,y1,b),point(r0,y0,b),group)
      }
      const [r0,y0]=profile[0], [r1,y1]=profile[profile.length-1]
      this.triangle([x,y0,z],point(r0,y0,a),point(r0,y0,b),group)
      this.triangle([x,y1,z],point(r1,y1,b),point(r1,y1,a),group)
    }
  }

  private box(x0:number,y0:number,z0:number,x1:number,y1:number,z1:number,group:number): void {
    this.quad([x0,y1,z0],[x0,y1,z1],[x1,y1,z1],[x1,y1,z0],group)
    this.quad([x0,y0,z1],[x0,y0,z0],[x1,y0,z0],[x1,y0,z1],group)
    this.quad([x0,y0,z0],[x0,y1,z0],[x1,y1,z0],[x1,y0,z0],group)
    this.quad([x1,y0,z1],[x1,y1,z1],[x0,y1,z1],[x0,y0,z1],group)
    this.quad([x0,y0,z1],[x0,y1,z1],[x0,y1,z0],[x0,y0,z0],group)
    this.quad([x1,y0,z0],[x1,y1,z0],[x1,y1,z1],[x1,y0,z1],group)
  }

  private bevelBox(x:number,z:number,hx:number,hz:number,y0:number,y1:number,b:number,group:number): void {
    const outline = [[-hx+b,-hz],[hx-b,-hz],[hx,-hz+b],[hx,hz-b],[hx-b,hz],[-hx+b,hz],[-hx,hz-b],[-hx,-hz+b]]
    for (let i=0;i<outline.length;i++) {
      const a=outline[i], c=outline[(i+1)%outline.length]
      this.quad([x+a[0],y0,z+a[1]],[x+a[0],y1,z+a[1]],[x+c[0],y1,z+c[1]],[x+c[0],y0,z+c[1]],group)
      this.triangle([x,y1,z],[x+c[0],y1,z+c[1]],[x+a[0],y1,z+a[1]],group)
      this.triangle([x,y0,z],[x+a[0],y0,z+a[1]],[x+c[0],y0,z+c[1]],group)
    }
  }

  private floorRect(x0:number,z0:number,x1:number,z1:number,y:number,group:number): void {
    this.quad([x0,y,z0],[x0,y,z1],[x1,y,z1],[x1,y,z0],group)
  }

  private floorRing(x:number,z:number,b:number,thickness:number,y:number,group:number): void {
    const outer = [[-x+b,-z],[x-b,-z],[x,-z+b],[x,z-b],[x-b,z],[-x+b,z],[-x,z-b],[-x,-z+b]]
    const inner = outer.map(p => [p[0]*(1-thickness/x),p[1]*(1-thickness/z)])
    for (let i=0;i<8;i++) {
      const j=(i+1)%8
      this.quad([outer[i][0],y,outer[i][1]],[inner[i][0],y,inner[i][1]],[inner[j][0],y,inner[j][1]],[outer[j][0],y,outer[j][1]],group)
    }
  }

  private floorRingAt(x:number,z:number,r:number,thickness:number,y:number,group:number): void {
    for (let i=0;i<24;i++) {
      const a=i*Math.PI/12,b=(i+1)*Math.PI/12
      this.quad([x+Math.cos(a)*r,y,z+Math.sin(a)*r],[x+Math.cos(a)*(r-thickness),y,z+Math.sin(a)*(r-thickness)],
        [x+Math.cos(b)*(r-thickness),y,z+Math.sin(b)*(r-thickness)],[x+Math.cos(b)*r,y,z+Math.sin(b)*r],group)
    }
  }
}
