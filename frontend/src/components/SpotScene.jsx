import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { spotStatus } from '../lib/format'

const tones = { Available: 0x57d9ad, Occupied: 0xf9a66a, Reserved: 0x9da9ff, Inactive: 0x778597 }

export default function SpotScene({ spots, onSelect }) {
  const host = useRef(null)
  const callback = useRef(onSelect)
  const [unavailable, setUnavailable] = useState(false)
  useEffect(() => { callback.current = onSelect }, [onSelect])
  useEffect(() => {
    const element = host.current
    if (!element || !spots.length) return
    let renderer
    const renderingCanvas = document.createElement('canvas')
    const context = renderingCanvas.getContext('webgl2', { antialias: true, alpha: true })
    if (!context) { queueMicrotask(() => setUnavailable(true)); return }
    try { renderer = new THREE.WebGLRenderer({ canvas: renderingCanvas, context, antialias: true, alpha: true }) }
    catch { queueMicrotask(() => setUnavailable(true)); return }

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(39, 1, .1, 500)
    const across = Math.min(8, Math.max(2, Math.ceil(Math.sqrt(spots.length * 1.6))))
    const rows = Math.ceil(spots.length / across)
    const width = across * 2 + 2
    const depth = rows * 4.6 + 2
    const distance = Math.max(width, depth)
    camera.position.set(distance * .68, distance * .82, distance * .92)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
    renderer.domElement.setAttribute('aria-hidden', 'true')
    element.appendChild(renderer.domElement)
    const controls = new OrbitControls(camera, renderer.domElement)
    controls.maxPolarAngle = Math.PI / 2.2
    controls.minDistance = distance * .32
    controls.maxDistance = distance * 3
    controls.update()

    scene.add(new THREE.HemisphereLight(0xddefff, 0x25364c, 2.1))
    const key = new THREE.DirectionalLight(0xffffff, 2.4)
    key.position.set(4, 14, 8)
    scene.add(key)
    const box = new THREE.BoxGeometry(1, 1, 1)
    const materials = new Map()
    function block(w, h, d, x, y, z, color) {
      if (!materials.has(color)) materials.set(color, new THREE.MeshStandardMaterial({ color }))
      const mesh = new THREE.Mesh(box, materials.get(color))
      mesh.scale.set(w, h, d)
      mesh.position.set(x, y, z)
      scene.add(mesh)
      return mesh
    }

    block(width, .45, depth, 0, -.26, 0, 0x263b52)
    const targets = []
    const textures = []
    spots.forEach((spot, i) => {
      const x = (i % across - (across - 1) / 2) * 2
      const z = (Math.floor(i / across) - (rows - 1) / 2) * 4.6
      const tile = block(1.72, .075, 2.7, x, .02, z, tones[spot.status] || tones.Inactive)
      tile.userData.spot = spot
      targets.push(tile)
      if (spot.status === 'Occupied') {
        const carWidth = spot.type === 2 ? .91 : .47
        block(carWidth, .41, 1.56, x, .28, z, 0x2c456a)
        block(carWidth * .82, .24, .84, x, .56, z - .08, 0x9cd9f0)
      }
      const label = document.createElement('canvas')
      label.width = 256; label.height = 64
      const context = label.getContext('2d')
      if (context) {
        context.font = 'bold 40px sans-serif'
        context.textAlign = 'center'; context.textBaseline = 'middle'; context.fillStyle = '#14263b'
        context.fillText(spot.code, 128, 32, 242)
        const texture = new THREE.CanvasTexture(label)
        const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, depthTest: false }))
        sprite.position.set(x, .08, z + 1.07)
        sprite.scale.set(1.4, .35, 1)
        scene.add(sprite); textures.push(texture)
      }
    })
    for (let i = 0; i < rows - 1; i++) {
      const z = (i - (rows - 1) / 2) * 4.6 + 2.3
      for (let j = 0; j < across; j++) block(.7, .018, .055, (j - (across - 1) / 2) * 2, 0, z, 0x93a5bb)
    }

    const render = () => renderer.render(scene, camera)
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
    let down
    const pointerDown = (event) => { down = [event.clientX, event.clientY] }
    const pointerUp = (event) => {
      if (!down || Math.hypot(event.clientX - down[0], event.clientY - down[1]) > 6) return
      const rect = renderer.domElement.getBoundingClientRect()
      const pointer = new THREE.Vector2((event.clientX - rect.left) / rect.width * 2 - 1, 1 - (event.clientY - rect.top) / rect.height * 2)
      const raycaster = new THREE.Raycaster()
      raycaster.setFromCamera(pointer, camera)
      const selected = raycaster.intersectObjects(targets, false)[0]?.object.userData.spot
      if (selected) callback.current(selected)
    }
    const canvas = renderer.domElement
    const contextLost = (event) => { event.preventDefault(); setUnavailable(true) }
    canvas.addEventListener('pointerdown', pointerDown)
    canvas.addEventListener('pointerup', pointerUp)
    canvas.addEventListener('webglcontextlost', contextLost)
    return () => {
      resize.disconnect()
      controls.dispose()
      canvas.removeEventListener('pointerdown', pointerDown)
      canvas.removeEventListener('pointerup', pointerUp)
      canvas.removeEventListener('webglcontextlost', contextLost)
      scene.traverse((node) => { if (node.isSprite) node.material.dispose() })
      textures.forEach((texture) => texture.dispose())
      box.dispose()
      materials.forEach((material) => material.dispose())
      renderer.dispose()
      canvas.remove()
    }
  }, [spots])

  return <>
    {unavailable ? <div className="scene-fallback"><p>Trình duyệt chưa mở được WebGL. Bạn vẫn có thể chọn vị trí bên dưới hoặc chuyển về 2D.</p></div> : <div className="spot-scene" ref={host} />}
    <label className="scene-select">Chọn vị trí <select value="" onChange={(event) => { const spot = spots.find((item) => String(item.id) === event.target.value); if (spot) onSelect(spot) }}><option value="">Chọn mã chỗ đỗ</option>{spots.map((spot) => <option key={spot.id} value={spot.id}>{spot.code} · {spotStatus[spot.status]}</option>)}</select></label>
  </>
}
