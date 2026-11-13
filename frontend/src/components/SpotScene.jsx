import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { spotStatus } from '../lib/format'
import { parkingLayout } from '../lib/parkingLayout'
import { buildParkingWorld } from './ParkingWorld'

export default function SpotScene({ spots, selectedId, filter = 0, onSelect, preview = false, fallback }) {
  const host = useRef(null)
  const live = useRef({ selectedId, filter, onSelect })
  const view = useRef(null)
  const [unavailable, setUnavailable] = useState(false)
  useEffect(() => {
    live.current = { selectedId, filter, onSelect }
    view.current?.update(selectedId, filter)
  }, [selectedId, filter, onSelect])

  useEffect(() => {
    const element = host.current
    if (!element || !spots.length) return
    const canvas = document.createElement('canvas')
    let renderer
    try {
      const context = canvas.getContext('webgl2', { antialias: true })
      if (!context) throw new Error('WebGL unavailable')
      renderer = new THREE.WebGLRenderer({ canvas, context, antialias: true })
    } catch {
      let active = true
      queueMicrotask(() => { if (active) setUnavailable(true) })
      return () => { active = false }
    }
    const layout = parkingLayout(spots)
    const distance = Math.max(layout.width, layout.length)
    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0xb9cbd6)
    scene.fog = new THREE.Fog(0xb9cbd6, distance * 2.2, distance * 4.5)
    const camera = new THREE.PerspectiveCamera(39, 1, .1, distance * 7)
    const controls = new OrbitControls(camera, canvas)
    controls.maxPolarAngle = Math.PI * .475
    controls.minDistance = distance * .12
    controls.maxDistance = distance * 3
    camera.position.set(distance * .63, distance * .80, distance * .86)
    controls.update()
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75))
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFShadowMap
    renderer.shadowMap.autoUpdate = false
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.1
    canvas.setAttribute('aria-hidden', 'true')
    element.appendChild(canvas)
    scene.add(new THREE.HemisphereLight(0xe2efff, 0x777263, 2.0))
    const sun = new THREE.DirectionalLight(0xffedd4, 2.35)
    sun.position.set(-distance * .6, distance * 1.3, distance * .42)
    sun.castShadow = true
    sun.shadow.mapSize.set(1024, 1024)
    const extent = distance * .82
    Object.assign(sun.shadow.camera, { left: -extent, right: extent, top: extent, bottom: -extent, near: 1, far: distance * 3.5 })
    sun.shadow.camera.updateProjectionMatrix()
    sun.shadow.normalBias = .07
    scene.add(sun)
    const world = buildParkingWorld(scene, layout)
    const render = () => renderer.render(scene, camera)
    const update = (id, kind) => {
      world.showSelection(id, kind)
      renderer.shadowMap.needsUpdate = true
      if (preview) {
        const point = layout.positions.find((item) => item.spot.id === id)
        const x = point?.x || 0, z = point?.z || 0
        const size = point ? Math.max(7, distance * .23) : distance * .9
        controls.target.set(x, 0, z)
        camera.position.set(x + size * .67, size * .88, z + size * .88)
        controls.update()
      }
      if (element.clientWidth > 0 && element.clientHeight > 0) render()
    }
    view.current = { update }
    const resize = new ResizeObserver(() => {
      if (!element.clientWidth || !element.clientHeight) return
      const aspect = element.clientWidth / element.clientHeight
      camera.aspect = aspect
      camera.fov = THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(19.5)) / Math.min(1, aspect)))
      camera.updateProjectionMatrix()
      renderer.setSize(element.clientWidth, element.clientHeight)
      render()
    })
    resize.observe(element)
    controls.addEventListener('change', render)
    update(live.current.selectedId, live.current.filter)
    let down
    const ray = new THREE.Raycaster()
    const pointerDown = (event) => { down = [event.clientX, event.clientY] }
    const pointerUp = (event) => {
      if (preview || !down || Math.hypot(event.clientX - down[0], event.clientY - down[1]) > 6) return
      const rect = canvas.getBoundingClientRect()
      ray.setFromCamera(new THREE.Vector2((event.clientX - rect.left) / rect.width * 2 - 1, 1 - (event.clientY - rect.top) / rect.height * 2), camera)
      const target = ray.intersectObjects(world.targets, false).find(({ object }) => !live.current.filter || object.userData.spot.type === live.current.filter)
      if (target) live.current.onSelect(target.object.userData.spot)
    }
    const contextLost = (event) => { event.preventDefault(); setUnavailable(true) }
    canvas.addEventListener('pointerdown', pointerDown)
    canvas.addEventListener('pointerup', pointerUp)
    canvas.addEventListener('webglcontextlost', contextLost)
    return () => {
      view.current = null
      resize.disconnect()
      controls.dispose()
      canvas.removeEventListener('pointerdown', pointerDown)
      canvas.removeEventListener('pointerup', pointerUp)
      canvas.removeEventListener('webglcontextlost', contextLost)
      world.dispose()
      sun.shadow.dispose()
      renderer.dispose()
      canvas.remove()
    }
  }, [spots, preview, unavailable])

  return <>
    {unavailable ? <><div className="scene-fallback"><p>Trình duyệt chưa mở được 3D. {fallback ? 'Đang hiển thị sơ đồ 2D.' : 'Bạn có thể chuyển sang 2D hoặc dùng danh sách vị trí.'}</p></div>{fallback}</> :
      <div className={'spot-scene' + (preview ? ' spot-scene-preview' : '')} ref={host} />}
    {!preview && <label className="scene-select">Chọn vị trí <select value={selectedId || ''} onChange={(event) => {
      const spot = spots.find((item) => String(item.id) === event.target.value)
      if (spot) onSelect(spot)
    }}><option value="" disabled>Chọn mã chỗ đỗ</option>{spots.filter((spot) => !filter || spot.type === filter).map((spot) =>
      <option key={spot.id} value={spot.id}>{spot.code} · {spotStatus[spot.status]}</option>)}</select></label>}
  </>
}
