import { SongState } from '@/store/songStore';
import type { TestingUtils, TestResult } from '.';
import { TestResultType } from '@/types/song';

// Extend the event type to include all used event types for type safety
type EventType =
	| 'music_start'
	| 'music_end'
	| 'freestyle'
	| 'preview'
	| 'player1_solo'
	| 'player2_solo'
	| 'battle_reset'
	| 'battle_end'
	| 'minigame_start'
	| 'minigame_end'
	| 'minigame_idle'
	| 'party_jump_start'
	| 'party_jump_end'
	| 'end'
	| string; // fallback for any other types

type EventWithType = { type: EventType; beat: number };

// Use EventWithType for events array

export async function checkSongEvents(
	song: SongState,
	utils: TestingUtils
): Promise<TestResult> {
	const events: EventWithType[] =
		(song.currentSong?.events as EventWithType[]) ?? [];
	const errors: string[] = [];
	const warnings: string[] = [];
	// 1. Song start/end
	const songStart = events.find((e) => e.type === 'music_start');
	const songEnd = events.find((e) => e.type === 'music_end');
	if (!songStart) errors.push('Missing music_start event.');
	if (!songEnd) errors.push('Missing music_end event.');
	if (!songEnd) errors.push('Missing song_end event.');

	// 2. Freestyle existence and timing
	const freestyleStart = events
		.filter((e) => e.type === 'freestyle')
		.sort((a, b) => a.beat - b.beat)[0];

	if (!freestyleStart) {
		errors.push('No freestyle section found. Freestyle will not work.');
	} else if (songEnd && typeof songEnd.beat === 'number') {
		const measureDiff = songEnd.beat - freestyleStart.beat;
		if (measureDiff < 9) {
			errors.push(
				`Freestyle section starts too late (only ${measureDiff} beats before song_end, should be at least 9).`
			);
		}
	}

	// 3. All events (preview, freestyle) after song_start and before song_end
	const songStartBeat = songStart?.beat ?? -Infinity;
	const songEndBeat = songEnd?.beat ?? Infinity;
	const previewEvents = events.filter((e) => e.type === 'preview');
	const freestyleEvents = events.filter((e) => e.type === 'freestyle');
	for (const e of [...previewEvents, ...freestyleEvents]) {
		if (e.beat <= songStartBeat) {
			errors.push(
				`${e.type} event at beat ${e.beat} is before song_start.`
			);
		}
		if (e.beat >= songEndBeat) {
			errors.push(`${e.type} event at beat ${e.beat} is after song_end.`);
		}
	}

	// 4. Battle steps checks (battleSteps track only)
	const battleEvents = song.currentSong?.battleSteps ?? [];
	const battleStart = battleEvents.find((e) => e.type === 'battle_reset');
	if (!battleStart)
		errors.push('Missing battle_reset event in battle steps.');

	// Minigame start/end matching (battleSteps only)
	const minigameStarts = battleEvents
		.filter((e) => e.type === 'minigame_start')
		.sort((a, b) => a.measure - b.measure);
	const minigameEnds = battleEvents
		.filter((e) => e.type === 'minigame_end')
		.sort((a, b) => a.measure - b.measure);

	if (minigameStarts.length === 0 && minigameEnds.length === 0) {
		warnings.push('No minigame event found in battle steps.');
	} else if (minigameStarts.length !== minigameEnds.length) {
		errors.push(
			'Mismatched minigame_start and minigame_end events in battle steps.'
		);
	} else {
		for (let i = 0; i < minigameStarts.length; i++) {
			if (minigameStarts[i].measure >= minigameEnds[i].measure) {
				errors.push(
					`minigame_start at measure ${minigameStarts[i].measure} does not end properly at ${minigameEnds[i].measure}.`
				);
			}
			// Check for overlap: next start must not be before previous end
			if (
				i > 0 &&
				minigameStarts[i].measure < minigameEnds[i - 1].measure
			) {
				errors.push(
					`minigame_start at measure ${minigameStarts[i].measure} overlaps previous minigame.`
				);
			}
			// Check that only minigame_idle events (if any) are between start and end
			const between = battleEvents.filter(
				(e) =>
					e.measure > minigameStarts[i].measure &&
					e.measure < minigameEnds[i].measure
			);
			const nonIdle = between.filter((e) => e.type !== 'minigame_idle');
			if (nonIdle.length > 0) {
				errors.push(
					`Only minigame_idle events are allowed between minigame_start at measure ${minigameStarts[i].measure} and minigame_end at measure ${minigameEnds[i].measure}.`
				);
			}
		}
	}

	// 7. Party jumps matching (can be many, must match Start -> End)
	const partyJumpStarts = events
		.filter((e) => e.type === 'party_jump_start')
		.sort((a, b) => a.beat - b.beat);
	const partyJumpEnds = events
		.filter((e) => e.type === 'party_jump_end')
		.sort((a, b) => a.beat - b.beat);
	if (partyJumpStarts.length !== partyJumpEnds.length) {
		errors.push('Mismatched party_jump_start and party_jump_end events.');
	}
	for (
		let i = 0;
		i < Math.min(partyJumpStarts.length, partyJumpEnds.length);
		i++
	) {
		if (partyJumpStarts[i].beat >= partyJumpEnds[i].beat) {
			errors.push(
				`party_jump_start at beat ${partyJumpStarts[i].beat} does not end properly at ${partyJumpEnds[i].beat}.`
			);
		}
		if (i > 0 && partyJumpStarts[i].beat < partyJumpEnds[i - 1].beat) {
			errors.push(
				`party_jump_start at beat ${partyJumpStarts[i].beat} overlaps previous party jump.`
			);
		}
	}

	if (errors.length > 0) {
		return {
			status: TestResultType.error,
			output: errors.join(' | '),
		};
	}
	if (warnings.length > 0) {
		return {
			status: TestResultType.warning,
			output: warnings.join(' | '),
		};
	}
	return {
		status: TestResultType.success,
		output: 'All event checks passed.',
	};
}
