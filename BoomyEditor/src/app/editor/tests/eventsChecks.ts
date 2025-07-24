import { SongState } from '@/store/songStore';
import type { TestingUtils, TestResult } from '.';
import { TestResultType } from '@/types/song';

// Extend the event type to include all used event types for type safety
type EventType =
	| 'music_start'
	| 'music_end'
	| 'freestyle_start'
	| 'freestyle_end'
	| 'preview'
	| 'player1_solo_start'
	| 'player1_solo_end'
	| 'player2_solo_start'
	| 'player2_solo_end'
	| 'party_battle_start'
	| 'party_battle_end'
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

	// 2. Freestyle section matching and uniqueness
	const freestyleEvents = events
		.filter(
			(e) => e.type === 'freestyle_start' || e.type === 'freestyle_end'
		)
		.sort((a, b) => a.beat - b.beat);
	let fsState: 'none' | 'started' | 'ended' = 'none';
	let freestyleCount = 0;
	for (const e of freestyleEvents) {
		if (e.type === 'freestyle_start') {
			if (fsState === 'started') {
				errors.push('Freestyle section started before previous ended.');
			}
			fsState = 'started';
			freestyleCount++;
		} else if (e.type === 'freestyle_end') {
			if (fsState !== 'started') {
				errors.push(
					'Freestyle section ended without a matching start.'
				);
			}
			fsState = 'ended';
		}
	}
	if (fsState === 'started') {
		errors.push('Freestyle section started but never ended.');
	}
	if (freestyleCount === 0) {
		warnings.push('No freestyle section found. Freestyle will not work.');
	}
	if (freestyleCount > 1) {
		errors.push('Multiple freestyle sections found. Only one is allowed.');
	}

	// 3. All events (preview, freestyle) after song_start and before song_end
	const songStartBeat = songStart?.beat ?? -Infinity;
	const songEndBeat = songEnd?.beat ?? Infinity;
	const previewEvents = events.filter((e) => e.type === 'preview');
	const freestyleBeats = freestyleEvents;
	for (const e of [...previewEvents, ...freestyleBeats]) {
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
	const battleStart = battleEvents.find((e) => e.type === 'battle_start');
	if (!battleStart)
		errors.push('Missing battle_start event in battle steps.');

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
			if (
				i > 0 &&
				minigameStarts[i].measure < minigameEnds[i - 1].measure
			) {
				errors.push(
					`minigame_start at measure ${minigameStarts[i].measure} overlaps previous minigame.`
				);
			}
		}
	}

	// 5. Party battle matching and non-overlapping (main events only)
	const partyBattleTypes = [
		{ start: 'party_battle_start', end: 'party_battle_end' },
	];
	for (const { start, end } of partyBattleTypes) {
		const starts = events
			.filter((e) => e.type === start)
			.sort((a, b) => a.beat - b.beat);
		const ends = events
			.filter((e) => e.type === end)
			.sort((a, b) => a.beat - b.beat);
		if (starts.length !== ends.length) {
			errors.push(`Mismatched ${start} and ${end} events.`);
		}
		for (let i = 0; i < Math.min(starts.length, ends.length); i++) {
			if (starts[i].beat >= ends[i].beat) {
				errors.push(
					`${start} at beat ${starts[i].beat} does not end properly at ${ends[i].beat}.`
				);
			}
			if (i > 0 && starts[i].beat < ends[i - 1].beat) {
				errors.push(
					`${start} at beat ${starts[i].beat} overlaps previous party battle session.`
				);
			}
		}
	}

	// 6. Solo sessions matching and non-overlapping
	const soloTypes = [
		{ start: 'player1_solo_start', end: 'player1_solo_end' },
		{ start: 'player2_solo_start', end: 'player2_solo_end' },
	];
	for (const { start, end } of soloTypes) {
		const starts = events
			.filter((e) => e.type === start)
			.sort((a, b) => a.beat - b.beat);
		const ends = events
			.filter((e) => e.type === end)
			.sort((a, b) => a.beat - b.beat);
		if (starts.length !== ends.length) {
			errors.push(`Mismatched ${start} and ${end} events.`);
		}
		for (let i = 0; i < Math.min(starts.length, ends.length); i++) {
			if (starts[i].beat >= ends[i].beat) {
				errors.push(
					`${start} at beat ${starts[i].beat} does not end properly at ${ends[i].beat}.`
				);
			}
			if (i > 0 && starts[i].beat < ends[i - 1].beat) {
				errors.push(
					`${start} at beat ${starts[i].beat} overlaps previous solo session.`
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
