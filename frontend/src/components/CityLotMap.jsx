import { useEffect, useRef, useState } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

export default function CityLotMap({ locations, selectedId, onChoose }) {
  const host = useRef(null)
  const view = useRef(null)
  const [tileError, setTileError] = useState(false)
  useEffect(() => {
    const map = L.map(host.current, { scrollWheelZoom: false, attributionControl: true })
    const tiles = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).on('tileerror', () => setTileError(true)).addTo(map)
    const markers = new Map()
    const bounds = []
    for (const lot of locations) {
      const point = [lot.latitude, lot.longitude]
      bounds.push(point)
      const label = document.createElement('span')
      label.textContent = lot.name
      const marker = L.marker(point, { title: lot.name, alt: lot.name,
        icon: L.divIcon({ className: 'city-marker', html: 'P', iconSize: [27, 27], iconAnchor: [13, 25] }) })
        .addTo(map).bindTooltip(label, {direction: 'top', offset: [0,-23]})
        .on('click', () => onChoose(String(lot.id)))
      markers.set(lot.id, marker)
    }
    map.fitBounds(bounds, { padding: [32, 34], maxZoom: 15, animate:false })
    const observer = new ResizeObserver(() => map.invalidateSize({pan:false}))
    observer.observe(host.current)
    view.current = {map, markers, tiles}
    return () => { observer.disconnect(); map.remove(); view.current = null }
  }, [locations, onChoose])
  useEffect(() => {
    if (!view.current) return
    const {map, markers} = view.current
    for (const [id, marker] of markers) {
      const selected = id === selectedId
      marker.getElement()?.classList.toggle('is-selected', selected)
      marker.setZIndexOffset(selected ? 500 : 0)
      if (selected) {
        if (!map.getBounds().contains(marker.getLatLng())) map.panTo(marker.getLatLng(), {animate:false})
        marker.openTooltip()
      } else marker.closeTooltip()
    }
  }, [locations, selectedId])
  return <div className="city-viewport">
    <div ref={host} className="city-map" role="region" aria-label="Bản đồ các bãi đỗ xe tại Đà Nẵng" />
    {tileError && <button className="retry-tiles" type="button" onClick={() => {setTileError(false); view.current?.tiles.redraw()}}>Tải lại nền bản đồ</button>}
  </div>
}
