'use client'

export const dynamic = 'force-dynamic'

import { useMemo, useState } from 'react'
import { useParams } from 'next/navigation'
import styles from '../../page.module.css'
import { useTelemetry } from '@/hooks/useTelemetry'
import { computeHeatBlobs, determineStrategyZone } from '@/lib/crowdLogic'
import { useCompass } from '@/hooks/useCompass'
import { useGuidance } from '@/hooks/useGuidance'
import { useVoiceGuidance } from '@/hooks/useVoiceGuidance'
import dynamicImport from 'next/dynamic'

// Dynamic Imports
const RadarContainer = dynamicImport(() => import('@/components/radar').then((mod) => mod.RadarContainer), { ssr: false })
const RadarGrid = dynamicImport(() => import('@/components/radar').then((mod) => mod.RadarGrid), { ssr: false })
const HeatBlobs = dynamicImport(() => import('@/components/radar').then((mod) => mod.HeatBlobs), { ssr: false })
const ScanLine = dynamicImport(() => import('@/components/radar').then((mod) => mod.ScanLine), { ssr: false })
const DirectionArrow = dynamicImport(() => import('@/components/radar').then((mod) => mod.DirectionArrow), { ssr: false })
const UserDot = dynamicImport(() => import('@/components/radar').then((mod) => mod.UserDot), { ssr: false })
const Compass = dynamicImport(() => import('@/components/hud').then((mod) => mod.Compass), { ssr: false })
const StatsBar = dynamicImport(() => import('@/components/hud').then((mod) => mod.StatsBar), { ssr: false })

export default function EventCockpitPage() {
	const params = useParams()
	const eventId = params.id

	// 1. TELEMETRY: Get live GPS data
	const { points, userLocation } = useTelemetry(eventId, true)

	// 2. SENSORS: Get compass hardware data
	const { heading, cardinalDirection, isSupported, requestPermission, permissionGranted } = useCompass()

	// Fallback if compass is initializing
	const safeHeading = useMemo(() => (isNaN(heading) || heading === null ? 0 : heading), [heading])

	// 3. MATH ENGINE: Translate GPS to Radar Blobs
	const blobs = useMemo(() => {
		if (!userLocation) return []
		// Pass 500m as the max radius of your radar screen
		return computeHeatBlobs(userLocation.latitude, userLocation.longitude, points, 500)
	}, [userLocation, points])

	// Sector status (Red/Yellow/Green overall warning)
	const zone = useMemo(() => determineStrategyZone(blobs), [blobs])

	// 4. TACTICAL GUIDANCE: AI calculates evasive maneuvers based on blobs + heading
	const guidance = useGuidance(safeHeading, blobs)

	// 5. VOICE GUIDANCE
	const [isVoiceActive, setIsVoiceActive] = useState(false)
	const [language, setLanguage] = useState('en-IN')
	useVoiceGuidance(guidance, isVoiceActive, language)

	return (
		<main className={styles.pageWrapper}>
			<header className={styles.header}>
				<div className={styles.logoGroup}>
					<h1 className={styles.logoTitle} style={{ fontFamily: 'var(--font-display)', letterSpacing: '0.1em' }}>
						<span style={{ color: 'var(--text-primary)' }}>APEX</span>
						<span style={{ color: 'var(--neon-cyan)', marginLeft: '4px' }}>TELEMETRY</span>
					</h1>
					<p className={styles.logoSubtitle}>SECTOR: {eventId?.slice(0, 8).toUpperCase()} // LIVE_LINK</p>
				</div>

				<div className={styles.headerRight}>
					<div
						className={`px-2 py-1 rounded border text-[10px] flex items-center gap-2 ${
							zone.status === 'RED'
								? 'bg-red-500/10 text-red-500 border-red-500'
								: zone.status === 'YELLOW'
									? 'bg-yellow-500/10 text-yellow-500 border-yellow-500'
									: 'bg-green-500/10 text-green-500 border-green-500'
						}`}
					>
						<span
							className={`w-1.5 h-1.5 rounded-full animate-pulse ${
								zone.status === 'RED' ? 'bg-red-500' : zone.status === 'YELLOW' ? 'bg-yellow-500' : 'bg-green-500'
							}`}
						/>
						{zone.text || 'SCANNING'}
					</div>
				</div>
			</header>

			<section className={styles.radarSection}>
				{/* WRAPPER: Constrains the entire radar UI to a mobile-sized column even on desktop */}
				<div className="w-full max-w-[340px] mx-auto flex flex-col">
					{/* Top Row */}
					<div className={`${styles.radarTopRow} flex justify-between items-end mb-4`}>
						<StatsBar overallDensity={zone.status} heading={Math.round(safeHeading)} cardinalDirection={cardinalDirection || 'N'} />
						<Compass heading={safeHeading} />
					</div>

					{/* Radar Circle */}
					<div className="relative aspect-square w-full" style={{ transform: `rotate(${-safeHeading}deg)`, transition: 'transform 0.1s ease-out' }}>
						<RadarContainer>
							<RadarGrid />
							<HeatBlobs blobs={blobs} />
							<ScanLine />
							<DirectionArrow heading={safeHeading} />
							<UserDot />
						</RadarContainer>
					</div>

					{/* Heading & Sensor Text */}
					<div className="flex flex-col items-center mt-6 font-mono">
						<span className="glow-text-cyan font-bold tracking-widest text-xl">HDG {String(Math.round(safeHeading)).padStart(3, '0')}°</span>
						<div className="text-[10px] text-[#8892a4] uppercase tracking-wider mt-2 opacity-80 flex items-center gap-1">
							Sensor:
							<span className={permissionGranted ? 'text-[#00ff66] font-bold' : 'text-[#ffcc00] font-bold'}>
								{permissionGranted ? 'ACTIVE' : 'STANDBY'}
							</span>
						</div>
					</div>

					{/* Sync Button */}
					<div className="flex flex-col items-center justify-center mt-4 min-h-[40px]">
						{!permissionGranted && isSupported && (
							<button
								onClick={requestPermission}
								className="bg-[#121212] border border-[#00eeff]/50 text-[#00eeff] text-[10px] px-6 py-2 rounded-full uppercase tracking-widest hover:bg-[#00eeff]/10 transition-colors"
							>
								Sync Compass
							</button>
						)}
					</div>
				</div>
			</section>

			<section className="mt-auto p-6 pb-12">
				<div
					style={{
						background: 'var(--bg-elevated)',
						borderLeft: `4px solid ${
							guidance.severity === 'high' ? 'var(--neon-red)' : guidance.severity === 'medium' ? 'var(--neon-yellow)' : 'var(--neon-cyan)'
						}`,
						padding: '16px',
						borderRadius: '4px',
					}}
				>
					{/* Message label + Voice toggle in same row */}
					<div className="flex items-center justify-between mb-1">
						<div
							className={`text-[10px] font-mono tracking-tighter ${
								guidance.severity === 'high' ? 'text-red-500' : guidance.severity === 'medium' ? 'text-yellow-500' : 'text-cyan-400'
							}`}
						>
							{guidance.message}
						</div>

						<div className="flex items-center gap-2">
							<select
								value={language}
								onChange={(e) => setLanguage(e.target.value)}
								className="bg-[#1a1a1a] text-[#8892a4] border border-[#333] rounded text-[9px] px-1 py-1 outline-none"
							>
								<option value="en-IN">English (India)</option>
								<option value="hi-IN">Hindi</option>
								<option value="ta-IN">Tamil</option>
								<option value="te-IN">Telugu</option>
								<option value="kn-IN">Kannada</option>
								<option value="ml-IN">Malayalam</option>
								<option value="mr-IN">Marathi</option>
								<option value="pa-IN">Punjabi</option>
								<option value="bn-IN">Bengali</option>
								<option value="gu-IN">Gujarati</option>
							</select>

							{/* 🎤 Voice Toggle Button */}
							<button
								onClick={() => {
									const next = !isVoiceActive
									if (typeof window !== 'undefined' && window.speechSynthesis) {
										window.speechSynthesis.cancel()
										const feedback = new SpeechSynthesisUtterance(
											next ? 'Voice guidance activated' : 'Voice guidance disabled'
										)
										feedback.lang = 'en-US'
										feedback.rate = 0.9
										window.speechSynthesis.speak(feedback)
									}
									setIsVoiceActive(next)
								}}
								className={`flex items-center gap-1.5 px-3 py-1 rounded-full border text-[9px] uppercase tracking-widest font-mono transition-all active:scale-95 ${
									isVoiceActive
										? 'bg-[#00eeff]/10 border-[#00eeff] text-[#00eeff]'
										: 'bg-[#1a1a1a] border-[#333] text-[#555] hover:border-[#00eeff]/40 hover:text-[#8892a4]'
								}`}
							>
								<span className={isVoiceActive ? 'animate-pulse' : ''}>🎤</span>
								{isVoiceActive ? 'VOICE ON' : 'VOICE OFF'}
							</button>
						</div>
					</div>

					<div className="text-lg font-bold font-display uppercase tracking-tight text-white/90">{guidance.suggestion}</div>
				</div>
			</section>
		</main>
	)
}
