import * as T from 'three'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import { parkingTones } from '../lib/parkingLayout'

export function buildParkingWorld(scene, layout) {
  const { positions, rows, across, pitch, depth, lane, width, length } = layout
  const materials = new Map(), textures = []
  const box = new T.BoxGeometry(1, 1, 1)
  const rounded = new RoundedBoxGeometry(1, 1, 1, 2, .18)
  const sphere = new T.IcosahedronGeometry(1, 2)
  const wheel = new T.CylinderGeometry(1, 1, 1, 16).rotateZ(Math.PI / 2)
  function material(color, roughness = .85, metalness = 0) {
    const key = [color, roughness, metalness].join('/')
    if (!materials.has(key)) materials.set(key, new T.MeshStandardMaterial({ color, roughness, metalness }))
    return materials.get(key)
  }
  function mesh(parent, geo, mat, w, h, d, x, y, z, shadow = true) {
    const part = new T.Mesh(geo, mat)
    part.scale.set(w, h, d); part.position.set(x, y, z)
    part.castShadow = shadow; part.receiveShadow = true
    parent.add(part)
    return part
  }
  function block(parent, color, w, h, d, x, y, z, soft = false) {
    return mesh(parent, soft ? rounded : box, material(color), w, h, d, x, y, z, h > .08)
  }
  const world = new T.Group()
  scene.add(world)
  const floor = document.createElement('canvas'); floor.width = floor.height = 256
  const ctx = floor.getContext('2d')
  ctx.fillStyle = '#495159'; ctx.fillRect(0, 0, 256, 256)
  let noise = 45631
  for (let i = 0; i < 12500; i++) {
    noise = (Math.imul(noise, 1664525) + 1013904223) >>> 0
    const gray = 45 + (noise >>> 16) % 65
    ctx.fillStyle = 'rgb(' + gray + ',' + (gray + 3) + ',' + (gray + 7) + ')'
    ctx.fillRect(noise & 255, (noise >>> 8) & 255, 1 + (noise >>> 28) % 2, 1)
  }
  const asphalt = new T.CanvasTexture(floor)
  asphalt.colorSpace = T.SRGBColorSpace; asphalt.wrapS = asphalt.wrapT = T.RepeatWrapping
  asphalt.repeat.set(width / 5, length / 5)
  asphalt.anisotropy = 4
  textures.push(asphalt)
  const ground = new T.MeshStandardMaterial({ map: asphalt, roughness: .98 })
  materials.set('asphalt', ground)
  const groundPlane = new T.PlaneGeometry(width, length).rotateX(-Math.PI / 2)
  mesh(world, groundPlane, ground, 1, 1, 1, 0, .004, 0, false)
  block(world, 0x89998d, width + 5, .28, length + 5, 0, -.43, 0, true)
  block(world, 0x5b6267, width + .18, .27, length + .18, 0, -.145, 0)
  const curb = 0xced2cb, white = 0xe9e8d7, yellow = 0xe1b452
  block(world, curb, .27, .22, length, -width / 2, .09, 0)
  block(world, curb, .27, .22, length, width / 2, .09, 0)
  block(world, curb, width, .22, .27, 0, .09, -length / 2)
  for (const x of [-width * .32, width * .32]) block(world, curb, width * .36, .22, .27, x, .09, length / 2)
  for (let row = 0; row < rows - 1; row++) {
    const z = (row + .5 - (rows - 1) / 2) * (depth + lane)
    for (let j = 0; j <= across; j++) block(world, yellow, 1.2, .012, .085, (j - across / 2) * pitch, .012, z)
  }
  for (let i = -2; i <= 2; i++) block(world, white, .29, .014, 1.3, i * .47, .014, length / 2 - .8)

  function tree(x, z, index) {
    block(world, 0xa7aea0, 1.65, .22, 1.65, x, -.09, z, true)
    block(world, 0x697f5a, 1.47, .1, 1.47, x, .027, z, true)
    block(world, 0x786351, .17, 1.36, .17, x, .63, z, true)
    const foliage = [0x506d43, 0x647c4c, 0x486a52]
    for (let j = 0; j < 3; j++) mesh(world, sphere, material(foliage[(j + index) % 3]), .67, .75, .71, x + (j - 1) * .35, 1.53 + (j === 1 ? .26 : 0), z)
  }
  function lamp(x, z) {
    block(world, 0x44545c, .14, 3.4, .14, x, 1.63, z, true)
    const arm = x < 0 ? .56 : -.56
    block(world, 0x44545c, 1.1, .12, .15, x + arm * .75, 3.23, z, true)
    block(world, 0xc7d9e6, .5, .09, .32, x + arm * 1.4, 3.16, z, true)
  }
  ;[-1, 1].forEach((side) => {
    for (let i = 0; i < rows; i++) {
      const z = (i - (rows - 1) / 2) * (depth + lane)
      tree(side * (width / 2 + .98), z, i)
      if (i % 2 === 0) lamp(side * (width / 2 + .19), z - depth * .45)
    }
  })
  block(world, 0xb9c7c6, 2.5, 2.2, 2.05, -3.6, 1.02, length / 2 + .9, true)
  block(world, 0x3a565d, 2.72, .16, 2.25, -3.6, 2.16, length / 2 + .9, true)
  block(world, 0x426273, 1.96, .68, .055, -3.6, 1.52, length / 2 + 1.93, true)
  block(world, 0xecad50, .25, 1.08, .27, -1.9, .47, length / 2 + .4)
  block(world, 0xece5d7, 3.6, .1, .14, .04, .92, length / 2 + .4)
  for (let i = 0; i < 4; i++) block(world, 0xd56154, .25, .105, .145, -1.35 + i * .83, .92, length / 2 + .4)

  const vehicleColors = [0xc0c6cb, 0x335e83, 0x7a4948, 0x58636d, 0xf2efe6, 0x637f76]
  function vehicle(spot, x, z, highlighted = false) {
    const car = spot.type === 2
    const w = car ? 1.69 : .63, d = car ? 3.78 : 1.9
    const paint = material(highlighted ? 0x04bfa5 : vehicleColors[spot.id % vehicleColors.length], .28, .23)
    const glass = material(0x324b5c, .21, .24)
    const rubber = material(0x25292d)
    const group = new T.Group()
    group.position.set(x, .01, z)
    group.rotation.y = spot.id % 2 ? Math.PI : 0
    world.add(group)
    mesh(group, rounded, paint, w, car ? .61 : .47, d, 0, car ? .5 : .39, 0)
    if (car) {
      mesh(group, rounded, glass, w * .84, .47, d * .50, 0, .92, -.13)
      mesh(group, rounded, paint, w * .77, .12, d * .29, 0, 1.13, -.17)
      for (const side of [-1, 1]) {
        block(group, 0x253945, .15, .17, .23, side * .9, .78, .37, true)
        block(group, 0xfff6da, .35, .11, .07, side * .50, .54, 1.84, true)
        block(group, 0xc64a42, .35, .11, .07, side * .50, .54, -1.84, true)
        for (const axle of [-1, 1]) {
          mesh(group, wheel, rubber, .30, .29, .30, side * .79, .30, axle * 1.18)
          mesh(group, wheel, material(0x9ba5ac, .47, .4), .025, .17, .17, side * .949, .30, axle * 1.18)
        }
      }
    } else {
      block(group, 0x303e46, .38, .14, .79, 0, .65, -.24, true)
      block(group, 0x495359, .72, .055, .12, 0, .9, .57, true)
      block(group, 0xe4e4d7, .28, .11, .06, 0, .62, .93, true)
      for (const axle of [-1, 1]) mesh(group, wheel, rubber, .13, .26, .26, 0, .25, axle * .69)
    }
    return group
  }

  const targetMap = new Map()
  const invisible = new T.MeshBasicMaterial({ visible: false })
  materials.set('hit', invisible)
  const stateLayers = []
  for (const { spot, x, z } of positions) {
    const color = parkingTones[spot.status] || parkingTones.Inactive
    const layer = new T.Group()
    const hit = mesh(layer, box, invisible, pitch - .13, .024, depth, x, .012, z, false)
    hit.userData.spot = spot
    targetMap.set(spot.id, hit)
    block(layer, white, .065, .012, depth, x - pitch / 2 + .05, .022, z)
    block(layer, white, .065, .012, depth, x + pitch / 2 - .05, .022, z)
    block(layer, white, pitch - .12, .014, .07, x, .022, z - depth / 2)
    block(layer, color, pitch - .19, .021, .18, x, .028, z + depth / 2 - .09)
    block(layer, 0x788789, pitch - .64, .13, .25, x, .064, z - depth / 2 + .45, true)
    const label = document.createElement('canvas'); label.width = 180; label.height = 72
    const labelCtx = label.getContext('2d')
    labelCtx.fillStyle = '#e8ecdf'
    labelCtx.textAlign = 'center'; labelCtx.textBaseline = 'middle'; labelCtx.font = 'bold 49px sans-serif'
    labelCtx.fillText(spot.code, 90, 36, 170)
    const texture = new T.CanvasTexture(label)
    texture.colorSpace = T.SRGBColorSpace
    textures.push(texture)
    const text = new T.MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 })
    materials.set('label:' + spot.id, text)
    mesh(layer, new T.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), text, 1.24, 1, .51, x, .036, z + depth / 2 - .62, false)
    if (spot.status === 'Inactive') {
      for (let i = -1; i <= 1; i++) block(layer, 0xd29d4b, .17, .25, .17, x + i * .58, .12, z + .55, true)
    }
    world.add(layer)
    const parked = spot.status === 'Occupied' ? vehicle(spot, x, z) : null
    stateLayers.push({ spot, layer, x, z, parked })
  }
  // Keep one marker per vehicle type and move it as the selection changes.
  const markers = [1, 2].map((type) => vehicle({ id: 0, type }, 0, 0, true))
  return {
    targets: [...targetMap.values()],
    showSelection(id, filter) {
      const selected = stateLayers.find((item) => item.spot.id === id)
      markers.forEach((marker, index) => {
        marker.visible = selected?.spot.type === index + 1
        if (marker.visible) marker.position.set(selected.x, .01, selected.z)
      })
      for (const item of stateLayers) {
        item.layer.visible = !filter || item.spot.type === filter
        if (item.parked) item.parked.visible = item.layer.visible && item !== selected
      }
    },
    dispose() {
      const geometries = new Set()
      world.traverse((node) => { if (node.geometry) geometries.add(node.geometry) })
      geometries.forEach((geo) => geo.dispose())
      textures.forEach((texture) => texture.dispose())
      materials.forEach((mat) => mat.dispose())
    },
  }
}
