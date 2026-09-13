'use client'

import { useEffect, useMemo, useState } from 'react'
import { MapContainer, TileLayer, CircleMarker, Circle, useMap } from 'react-leaflet'
import { Target, Satellite, MapPin, Sun, Moon } from 'lucide-react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

// Leaflet Icon Fix for Production
if (typeof window !== 'undefined') {
	delete L.Icon.Default.prototype._getIconUrl
	L.Icon.Default.mergeOptions({
		iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
		iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
		shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
	})
}

function LocateControl({ geofence }) {
	const map = useMap()
	const hasEventCoords = !!(geofence?.center_lat && geofence?.center_long)

	const handleJump = () => {
		if (hasEventCoords) {
			map.flyTo([geofence.center_lat, geofence.center_long], 17, {
				duration: 1.5,
				easeLinearity: 0.25,
			})
		}
	}

	return (
		<div className="absolute top-24 left-6 z-[1000]">
			<button
				onClick={handleJump}
				disabled={!hasEventCoords}
				className={`group flex items-center gap-3 bg-black/80 border p-2 pr-4 rounded-sm backdrop-blur-md transition-all active:scale-95 shadow-lg 
                    ${hasEventCoords ? 'border-[#222] hover:border-[#00eeff]' : 'border-red-900/50 opacity-50 cursor-not-allowed'}`}
			>
				<div className={`${hasEventCoords ? 'bg-[#00eeff]/10' : 'bg-red-500/10'} p-1.5 rounded-sm`}>
					<MapPin className={`w-4 h-4 ${hasEventCoords ? 'text-[#00eeff] animate-pulse' : 'text-red-500'}`} />
				</div>
				<div className="flex flex-col items-start leading-none">
					<span className="text-[10px] font-mono text-gray-500 uppercase tracking-tighter">{hasEventCoords ? 'Sector' : 'Offline'}</span>
					<span className={`text-xs font-bold uppercase tracking-wider ${hasEventCoords ? 'text-white' : 'text-red-500'}`}>
						{hasEventCoords ? 'EVENT_LOCK' : 'NO_SIGNAL'}
					</span>
				</div>
			</button>
		</div>
	)
}

export default function StrategyMap({ points = [], userLocation = null, geofence = null }) {
	const [mounted, setMounted] = useState(false)
	const [mapTheme, setMapTheme] = useState('dark')
	const [currentUserId, setCurrentUserId] = useState(null) // 🏁 Track local user

	useEffect(() => {
		setMounted(true)

		// Load Theme
		const savedTheme = localStorage.getItem('apex_map_theme')
		if (savedTheme === 'light' || savedTheme === 'dark') {
			setMapTheme(savedTheme)
		}

		// Retrieve local device ID
		const localId = localStorage.getItem('apex_device_id')
		if (localId) {
			setCurrentUserId(localId)
		}
	}, [])

	const toggleTheme = () => {
		setMapTheme((prevTheme) => {
			const newTheme = prevTheme === 'dark' ? 'light' : 'dark'
			localStorage.setItem('apex_map_theme', newTheme)
			return newTheme
		})
	}

	// GROUPING LOGIC: Organizes flat points into drivers
	const devices = useMemo(() => {
		const groups = {}
		if (!Array.isArray(points)) return groups

		points.forEach((p) => {
			if (!p || !p.device_id || p.device_id === 'DRV-SYNCING') return
			const id = p.device_id
			if (!groups[id]) groups[id] = []
			groups[id].push(p)
		})
		return groups
	}, [points])

	// SPATIAL CLUSTERING ENGINE
	const densityZones = useMemo(() => {
		const zones = []
		// Grab only the most recent location for each active unit
		const activeLocations = Object.values(devices).map((history) => history[0])

		activeLocations.forEach((pt) => {
			// ~0.0004 degrees is roughly 40 meters. We use this as our clustering threshold.
			const CLUSTER_THRESHOLD = 0.0004
			let foundZone = zones.find((z) => Math.abs(z.lat - pt.latitude) < CLUSTER_THRESHOLD && Math.abs(z.lng - pt.longitude) < CLUSTER_THRESHOLD)

			if (foundZone) {
				// Average the coordinates to keep the heat blob centered over the group
				foundZone.lat = (foundZone.lat * foundZone.count + pt.latitude) / (foundZone.count + 1)
				foundZone.lng = (foundZone.lng * foundZone.count + pt.longitude) / (foundZone.count + 1)
				foundZone.count += 1
			} else {
				// Initialize a new zone
				zones.push({ lat: pt.latitude, lng: pt.longitude, count: 1 })
			}
		})
		return zones
	}, [devices])

	const currentCenter = useMemo(() => {
		if (geofence?.center_lat) return [geofence.center_lat, geofence.center_long]
		if (userLocation) return [userLocation.latitude, userLocation.longitude]
		return null
	}, [geofence, userLocation])

	if (!mounted || !currentCenter || typeof window === 'undefined') {
		return (
			<div className="w-full h-full bg-[#0b0b0b] flex flex-col items-center justify-center font-mono border border-[#222] rounded-xl">
				<Satellite className="w-8 h-8 text-[#00eeff]/40 mb-4 animate-bounce" />
				<span className="text-[#00eeff] text-[10px] uppercase tracking-[0.4em] animate-pulse">Establishing_Satellite_Link...</span>
			</div>
		)
	}

	const tileUrl = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
	const tileClass = mapTheme === 'dark' ? 'filter invert hue-rotate-180 brightness-75 contrast-125' : ''
	const mapBgColor = mapTheme === 'dark' ? '#0b0b0b' : '#e5e7eb'
	const primaryColor = mapTheme === 'dark' ? '#00eeff' : '#0055ff'
	const userColor = '#00ff66' // Neon Green for the local user
	const borderColor = mapTheme === 'dark' ? '#fff' : '#111'

	return (
		<div
			className="w-full h-full relative overflow-hidden rounded-xl border border-[#222] transition-colors duration-300"
			style={{ backgroundColor: mapBgColor }}
		>
			<MapContainer center={currentCenter} zoom={17} style={{ height: '100%', width: '100%', background: 'transparent' }} zoomControl={false}>
				<TileLayer url={tileUrl} className={tileClass} />

				{geofence?.center_lat && (
					<Circle
						center={[geofence.center_lat, geofence.center_long]}
						radius={geofence.radius_meters || 500}
						pathOptions={{ color: primaryColor, fillColor: primaryColor, fillOpacity: 0.05, weight: 1, dashArray: '10, 10' }}
					/>
				)}

				<LocateControl geofence={geofence} />

				{/* RENDER HEATMAP ZONES */}
				{densityZones.map((zone, i) => {
					if (zone.count < 2) return null
					const isHigh = zone.count >= 4
					const isMedium = zone.count >= 2
					const zoneColor = isHigh ? '#ff3333' : isMedium ? '#ffcc00' : primaryColor
					const zoneRadius = 20 + zone.count * 8
					const zoneOpacity = Math.min(0.5, 0.15 + zone.count * 0.05)

					return (
						<Circle
							key={`heatmap-zone-${i}`}
							center={[zone.lat, zone.lng]}
							radius={zoneRadius}
							pathOptions={{
								color: zoneColor,
								fillColor: zoneColor,
								fillOpacity: zoneOpacity,
								weight: 1,
								className: isHigh ? 'animate-pulse' : '',
							}}
						/>
					)
				})}

				{/* RENDER INDIVIDUALS */}
				{Object.entries(devices).map(([deviceId, history]) => {
					const latest = history[0]
					const trail = history.slice(1, 12)

					// CHECK IF THIS IS THE LOCAL USER
					const isMe = currentUserId === deviceId
					const activeColor = isMe ? userColor : primaryColor

					return (
						<div key={deviceId}>
							{/* Main Active Dot */}
							<CircleMarker
								center={[latest.latitude, latest.longitude]}
								radius={isMe ? 8 : 6} // Make user dot slightly larger
								pathOptions={{
									fillColor: activeColor,
									color: isMe ? '#fff' : borderColor,
									weight: isMe ? 3 : 2,
									fillOpacity: 1,
								}}
							/>
							{/* History Trail */}
							{trail.map((tp, i) => (
								<CircleMarker
									key={`${deviceId}-trail-${i}`}
									center={[tp.latitude, tp.longitude]}
									radius={isMe ? 3 : 2}
									pathOptions={{
										fillColor: activeColor,
										color: 'transparent',
										fillOpacity: 0.4 - i * 0.04,
									}}
								/>
							))}
						</div>
					)
				})}
			</MapContainer>

			{/* HUD Status */}
			<div className="absolute top-6 left-6 z-[1000] flex flex-col gap-2 pointer-events-none">
				<div className="bg-black/80 border-l-4 border-[#00ff66] p-3 backdrop-blur-md flex flex-col shadow-lg">
					<span className="text-[10px] text-gray-400 font-mono uppercase tracking-widest leading-none mb-1">Fleet Connectivity</span>
					<span className="text-[#00ff66] font-bold text-xs animate-pulse tracking-tighter uppercase">
						{Object.keys(devices).length} Units_Syncing
					</span>
				</div>
			</div>

			{/* THEME TOGGLE */}
			<div className="absolute top-24 right-6 z-[1000]">
				<button
					onClick={toggleTheme}
					className="flex items-center justify-center w-10 h-10 bg-black/80 border border-[#222] hover:border-[#00eeff] rounded-full backdrop-blur-md transition-all active:scale-95 shadow-lg text-gray-400 hover:text-[#00eeff]"
				>
					{mapTheme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
				</button>
			</div>
		</div>
	)
}
