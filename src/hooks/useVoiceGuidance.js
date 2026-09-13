'use client'

import { useEffect, useRef } from 'react'

export function useVoiceGuidance(guidance, isVoiceActive, voice = 'Nalini', language = 'hi-IN') {
	const audioRef = useRef(null)

	useEffect(() => {
		if (typeof window === 'undefined') return
		if (!isVoiceActive || !guidance || guidance.severity === 'low') return

		const textToSpeak = `${guidance.message}. ${guidance.suggestion}`

		const fetchTTS = async () => {
			try {
				const response = await fetch('https://api.vachana.ai/api/v1/tts/inference', {
					method: 'POST',
					headers: {
						'Content-Type': 'application/json',
						'X-API-Key-ID': process.env.NEXT_PUBLIC_GNANI_API_KEY
					},
					body: JSON.stringify({
						text: textToSpeak,
						voice: voice,
						model: 'timbre-v2.5',
						language: language,
						speed: 1.0,
						audio_config: {
							encoding: 'linear_pcm',
							container: 'wav',
							num_channels: 1,
							sample_rate: 48000,
							sample_width: 2
						}
					})
				})

				if (!response.ok) throw new Error('Gnani TTS error')

				const arrayBuffer = await response.arrayBuffer()
				const blob = new Blob([arrayBuffer], { type: 'audio/wav' })
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
	}, [guidance, isVoiceActive, voice, language])
}
