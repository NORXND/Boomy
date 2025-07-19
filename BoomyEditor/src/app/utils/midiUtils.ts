import { Midi } from '@tonejs/midi';
import { TempoChange } from '../types/song';

/**
 * Extracts tempo changes from a MIDI file
 * @param midiPath Path to the MIDI file
 * @returns Promise resolving to an array of TempoChange objects
 */
export async function extractTempoChangesFromMidi(
	midiPath: string
): Promise<TempoChange[]> {
	try {
		// Read MIDI file using Electron API
		const midiBuffer = await window.electronAPI.readFileBuffer(midiPath);
		const uint8Array = new Uint8Array(midiBuffer);

		// Parse MIDI with Tone.js
		const midi = new Midi(uint8Array);

		// Extract tempo changes (BPM changes throughout the song)
		const tempoChanges: TempoChange[] = [];

		// Look for tempo changes in header track
		const headerTrack = midi.header;
		if (headerTrack.tempos && headerTrack.tempos.length > 0) {
			headerTrack.tempos.forEach((tempo) => {
				tempoChanges.push({
					tick: tempo.ticks,
					bpm: tempo.bpm,
				});
			});
		} else {
			// Default tempo if none specified
			tempoChanges.push({
				tick: 0,
				bpm: 120,
			});
		}

		return tempoChanges;
	} catch (error) {
		console.error('Failed to extract tempo changes from MIDI file:', error);
		// Return default tempo if there's an error
		return [
			{
				tick: 0,
				bpm: 120,
			},
		];
	}
}
