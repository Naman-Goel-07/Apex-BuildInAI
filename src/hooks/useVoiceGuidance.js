'use client'

import { useEffect, useRef } from 'react'

export function useVoiceGuidance(guidance, isVoiceActive) {
	const audioRef = useRef(null)

	useEffect(() => {
		if (typeof window === 'undefined') return
		if (!isVoiceActive || !guidance || guidance.severity === 'low') return

		const textToSpeak = `${guidance.message}. ${guidance.suggestion}`

		const fetchTTS = async () => {
			try {
				const response = await fetch('https://api.gnani.ai/tts', {
					method: 'POST',
					headers: {
						'Content-Type': 'application/json',
						'gnani-apikey': process.env.NEXT_PUBLIC_GNANI_API_KEY
					},
					body: JSON.stringify({ text: textToSpeak })
				})

				if (!response.ok) throw new Error('Gnani TTS error')

				const arrayBuffer = await response.arrayBuffer()
				const blob = new Blob([arrayBuffer], { type: 'audio/mpeg' })
				const url = URL.createObjectURL(blob)

				if (audioRef.current) {
					audioRef.current.pause()
					URL.revokeObjectURL(audioRef.current.src)
				}

				const audio = new Audio(url)
				audioRef.current = audio
				audio.play().catch((e) => console.error('Audio play blocked:', e))

				audio.onended = () => {
					URL.revokeObjectURL(url)
				}
			} catch (error) {
				console.error('Error fetching TTS:', error)
			}
		}

		fetchTTS()

		return () => {
			if (audioRef.current) {
				audioRef.current.pause()
				if (audioRef.current.src) {
					URL.revokeObjectURL(audioRef.current.src)
				}
			}
		}
	}, [guidance, isVoiceActive])
}
