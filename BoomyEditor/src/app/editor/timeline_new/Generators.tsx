import { SongState } from '@/store/songStore';
import { CameraEvent, CameraPosition, MoveEvent } from '@/types/song';
import { toast } from 'sonner';

const SUPEREASY_MOVES = [
	'amped_l',
	'back',
	'back_l',
	'bent_clap',
	'blazer',
	'blend',
	'booty_down',
	'broadway',
	'bum_a_ride',
	'chill',
	'clap_clap',
	'concert_jump_l',
	'concert_jump_r',
	'courier',
	'crook',
	'crunch_r',
	'east_r',
	'eye_spy',
	'gank',
	'get_back',
	'hammer',
	'hands_in_the_air',
	'headbanger',
	'headwrush',
	'heel_tap_l',
	'heel_tap_r',
	'hello_l',
	'hello_r',
	'hip_swing',
	'how_we_do',
	'hyper_r',
	'leave_me_alone',
	'loom',
	'make_way',
	'muscle_man',
	'no_worries',
	'open_hip_wind',
	'portrait',
	'reach_down_arms',
	'ride_it',
	'rigopulpop_l',
	'rigopulpop_r',
	'say_what',
	'select',
	'select_r',
	'silk',
	'silly_wind_winner',
	'slice_out',
	'snap_l',
	'snap_r',
	'sound_check',
	'step_center',
	'step_center_and_clap',
	'step_side',
	'step_side_and_clap',
	'striker',
	'swing_clap',
	'swirlies',
	't_d_o_e_scratch',
	'tap_front',
	'tell_em_r',
	'ten_step',
	'this_or_that',
	'thrasher',
	'throw_it_up',
	'torch',
	'want_cha',
	'west_l',
	'woo',
	'woo_jab',
];

const checkMove = async (
	state: SongState,
	move: string,
	song: string,
	category: string
) => {
	const movePath = `${state.currentSong.move_lib}/${category}/${song}/${move}`;

	// Load move.json
	const jsonPath = `${movePath}/move.json`;
	const jsonExists = await window.electronAPI.pathExists(jsonPath);
	if (jsonExists) {
		const jsonData = await window.electronAPI.readJsonFile(jsonPath);
		return jsonData;
	} else {
		return null;
	}
};

const decodeFlags = (flags: number): string[] => {
	const flagNames: string[] = [];
	if (flags & 2) flagNames.push('Scored');
	if (flags & 8) flagNames.push('Final Pose');
	if (flags & 0x10) flagNames.push('Suppress Guide Gesture');
	if (flags & 0x20) flagNames.push('Omit Minigame');
	if (flags & 0x40) flagNames.push('Useful');
	if (flags & 0x80) flagNames.push('Suppress Practice Options');
	return flagNames;
};

// Helper to get random camera position (excluding VENUE and CLOSEUP)
function getRandomCameraPosition(): CameraPosition {
	const positions = Object.values(CameraPosition).filter(
		(pos) => pos !== CameraPosition.Venue && pos !== CameraPosition.Closeup
	);
	return positions[Math.floor(Math.random() * positions.length)];
}

export async function generateDifficultyMoves(
	difficulty: 'supereasy' | 'easy' | 'medium',
	state: SongState
): Promise<MoveEvent[] | null> {
	// 1. Get expert moves (assume state.currentSong.moves is an array of MoveEvent sorted by measure)
	const expertMoves: MoveEvent[] = state.currentSong.timeline.expert.moves;

	// 2. For each move, check its difficulty using checkMove
	const filteredMoves: MoveEvent[] = [];
	for (const move of expertMoves) {
		const moveData = await checkMove(
			state,
			move.move,
			move.move_song,
			move.move_origin
		);
		if (!moveData) continue;
		const moveFlags = decodeFlags(moveData.clips[move.clip].flags);
		if (moveFlags.includes('Final Pose') || !moveFlags.includes('Scored')) {
			filteredMoves.push(move);
			continue;
		}

		console.log('Move:', move.move, 'Flags:', moveFlags);

		const moveDiff = moveData.difficulty;
		if (difficulty === 'medium' && moveDiff < 2) filteredMoves.push(move);
		if (difficulty === 'easy' && moveDiff === 0) filteredMoves.push(move);
		if (difficulty === 'supereasy') {
			if (SUPEREASY_MOVES.includes(moveData.name)) {
				filteredMoves.push(move);
			}
		}
	}

	if (filteredMoves.length === 0) {
		toast.warning(
			`No moves found for ${difficulty} difficulty. Generation aborted.`
		);
		return null;
	}

	const hasFirstMeasure = filteredMoves.some((m) => m.measure === 1);

	if (!hasFirstMeasure) {
		toast.warning(
			`No moves found for ${difficulty} difficulty at first measure. Generation aborted.`
		);
		return null;
	}

	// 5. Fill gaps by repeating previous move
	const filledMoves: MoveEvent[] = [];
	let prevMove = null;
	const maxMeasure = Math.max(...expertMoves.map((m) => m.measure));
	for (let measure = 0; measure <= maxMeasure; measure++) {
		const move = filteredMoves.find((m) => m.measure === measure);
		if (move) {
			filledMoves.push(move);
			prevMove = move;
		} else if (prevMove) {
			// Repeat previous move at this measure
			filledMoves.push({ ...prevMove, measure });
		}
	}

	return filledMoves;
}

export async function generateCamerasForDifficulty(
	difficulty: 'easy' | 'medium' | 'expert',
	state: SongState
): Promise<CameraEvent[] | void> {
	let moves: MoveEvent[] = [];
	if (difficulty === 'expert')
		moves = state.currentSong.timeline.expert.moves;
	else if (difficulty === 'medium')
		moves = state.currentSong.timeline.medium.moves;
	else if (difficulty === 'easy')
		moves = state.currentSong.timeline.easy.moves;

	if (!moves || moves.length === 0) return [];

	const cameras: CameraEvent[] = [];

	// 1. First beat is always VENUE (at beat 0)
	cameras.push({ beat: 0, camera: CameraPosition.Venue });

	// 2. Find rest area (measures with non-scored moves)
	const restMeasures: number[] = [];
	for (const move of moves) {
		const moveData = await checkMove(
			state,
			move.move,
			move.move_song,
			move.move_origin
		);
		if (!moveData) continue;
		const moveFlags = decodeFlags(moveData.clips[move.clip].flags);
		if (!moveFlags.includes('Scored')) {
			if (!restMeasures.includes(move.measure)) {
				restMeasures.push(move.measure);
			}
		}
	}

	// 3. Find first scored move (not in restMeasures)
	const scoredMoves = moves.filter((m) => !restMeasures.includes(m.measure));
	const firstScoredMeasure =
		scoredMoves.length > 0
			? Math.min(...scoredMoves.map((m) => m.measure))
			: null;

	// 4. Always add a random camera 2-4 beats before first scored move (even if in rest area)
	let beforeScoredBeat: number | null = null;
	if (firstScoredMeasure && firstScoredMeasure > 1) {
		const firstScoredBeat = (firstScoredMeasure - 1) * 4;
		beforeScoredBeat =
			firstScoredBeat - (2 + Math.floor(Math.random() * 3)); // 2-4 beats before
		if (beforeScoredBeat >= 0) {
			cameras.push({
				beat: beforeScoredBeat,
				camera: getRandomCameraPosition(),
			});
		}
	}

	// 5. If there is a rest area, randomly place CLOSEUP in the middle of it (in beats), but not if it would overwrite the beforeScoredBeat
	let restEnd = -1;
	console.log('Rest measures:', restMeasures);
	if (restMeasures.length > 0) {
		const restStart = Math.min(...restMeasures);
		restEnd = Math.max(...restMeasures);
		if (restEnd > restStart) {
			const midRestMeasure =
				restStart + Math.floor((restEnd - restStart) / 2);
			const midRestBeat = (midRestMeasure - 1) * 4;
			// Randomly decide to add CLOSEUP (60% chance now)
			if (
				Math.random() < 0.6 &&
				midRestBeat !== beforeScoredBeat // don't overwrite beforeScoredBeat
			) {
				cameras.push({
					beat: midRestBeat,
					camera: CameraPosition.Closeup,
				});
			}
		}
	}

	// 6. Add random camera every 3-4 measures (randomized), but only after the end of the rest area
	const lastMoveMeasure = Math.max(...moves.map((m) => m.measure));
	const afterRestMeasure = restEnd > 0 ? restEnd + 1 : 2; // start after rest area, or after measure 1 if no rest area
	let nextCameraMeasure =
		afterRestMeasure + 3 + Math.floor(Math.random() * 2); // 3 or 4 after rest

	while (nextCameraMeasure <= lastMoveMeasure) {
		const beat = (nextCameraMeasure - 1) * 4;
		// Don't duplicate a camera at the same beat as beforeScoredBeat or CLOSEUP
		if (!cameras.some((c) => c.beat === beat)) {
			cameras.push({
				beat,
				camera: getRandomCameraPosition(),
			});
		}
		nextCameraMeasure += 3 + Math.floor(Math.random() * 2); // next in 3-4 measures
	}

	// Sort cameras by beat
	cameras.sort((a, b) => a.beat - b.beat);

	return cameras;
}
