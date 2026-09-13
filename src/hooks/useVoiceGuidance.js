'use client'

import { useEffect, useRef } from 'react'

export function useVoiceGuidance(guidance, isVoiceActive, voice = 'Nalini', language = 'hi-IN') {
	const audioRef = useRef(null)
	const isSpeaking = useRef(false)

	// Clean up if voice is toggled off or component unmounts
	useEffect(() => {
		if (!isVoiceActive && audioRef.current) {
			audioRef.current.pause()
			if (audioRef.current.src) {
				URL.revokeObjectURL(audioRef.current.src)
			}
			isSpeaking.current = false
		}
		return () => {
			if (audioRef.current) {
				audioRef.current.pause()
				if (audioRef.current.src) {
					URL.revokeObjectURL(audioRef.current.src)
				}
			}
			isSpeaking.current = false
		}
	}, [isVoiceActive])

	// Play guidance warnings sequentially without spamming
	useEffect(() => {
		if (typeof window === 'undefined') return
		if (!isVoiceActive || !guidance || guidance.severity === 'low') return
		if (isSpeaking.current) return

		let textToSpeak = `${guidance.message}. ${guidance.suggestion}`

		const fetchTTS = async () => {
			isSpeaking.current = true
			try {
				if (language !== 'en-IN') {
					const tl = language.split('-')[0] // extract 'hi', 'ta', etc.
					const transRes = await fetch(`https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=${tl}&dt=t&q=${encodeURIComponent(textToSpeak)}`)
					if (transRes.ok) {
						const data = await transRes.json()
						if (data && data[0]) {
							textToSpeak = data[0].map(item => item[0]).join(' ')
						}
					}
				}

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

				// Ensure previous audio is fully stopped (just in case)
				if (audioRef.current) {
					audioRef.current.pause()
					URL.revokeObjectURL(audioRef.current.src)
				}

				const audio = new Audio(url)
				audioRef.current = audio
				audio.play().catch((e) => {
					console.error('Audio play blocked:', e)
					isSpeaking.current = false
				})

				audio.onended = () => {
					URL.revokeObjectURL(url)
					isSpeaking.current = false
				}
				
				audio.onerror = () => {
					isSpeaking.current = false
				}
			} catch (error) {
				console.error('Error fetching TTS:', error)
				isSpeaking.current = false
			}
		}

		fetchTTS()
	}, [guidance, isVoiceActive, voice, language])
}
