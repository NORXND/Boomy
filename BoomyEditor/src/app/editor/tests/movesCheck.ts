import { SongState } from '@/store/songStore';
import { Song, TestResult, TestResultType } from '../../types/song';
import type { TestingUtils } from '.';

export async function measureCheck(
	song: SongState,
	utils: TestingUtils
): Promise<TestResult> {
	try {
		if (!song.currentSong.timeline) {
			return {
				status: TestResultType.error,
				output: 'No timeline data to check for first measure',
			};
		}

		const difficulties = ['easy', 'medium', 'expert'] as const;
		let hasFirstMeasureMoves = false;

		for (const difficulty of difficulties) {
			const moves = song.currentSong.timeline[difficulty].moves;
			if (moves && moves.length > 0) {
				// Check if any moves are in the first measure (typically beats 0-4)
				const firstMeasureMoves = moves.filter(
					(move) => move.beat == 1
				);
				if (firstMeasureMoves.length > 0) {
					hasFirstMeasureMoves = true;
					break;
				}
			}
		}

		if (hasFirstMeasureMoves) {
			return {
				status: TestResultType.success,
				output: 'Song has moves in the first measure',
			};
		} else {
			return {
				status: TestResultType.error,
				output: 'Song has no moves in the first measure',
			};
		}
	} catch (error) {
		return {
			status: TestResultType.error,
			output: `First measure check failed: ${error}`,
		};
	}
}

export async function measureFilledCheck(
	song: SongState,
	_: TestingUtils
): Promise<TestResult> {
	try {
		if (!song.currentSong.timeline) {
			return {
				status: TestResultType.error,
				output: 'No timeline data to check.',
			};
		}

		const difficulties = ['easy', 'medium', 'expert'] as const;
		let measureFilled = 0;

		for (const difficulty of difficulties) {
			const len = song.currentSong.timeline[difficulty].moves.length;
			if (measureFilled != 0) {
				if (measureFilled != len) {
					return {
						status: TestResultType.warning,
						output: `There are different number of moves in the first measure for difficulties.`,
					};
				}
			} else {
				measureFilled = len;
			}
		}

		return {
			status: TestResultType.success,
			output: 'All difficulties have the same number of moves in the first measure',
		};
	} catch (error) {
		return {
			status: TestResultType.error,
			output: `First measure check failed: ${error}`,
		};
	}
}

export async function hasFinishingMove(
	song: SongState,
	utils: TestingUtils
): Promise<TestResult> {
	try {
		if (!song.currentSong.timeline) {
			return {
				status: TestResultType.error,
				output: 'No timeline data to check.',
			};
		}

		const difficulties = ['easy', 'medium', 'expert'] as const;
		let hasFinishingMove = false;

		for (const difficulty of difficulties) {
			for (const move of song.currentSong.timeline[difficulty].moves) {
				// Assuming a finishing move is defined as a move at the last beat of the song
				if (move.move) {
					hasFinishingMove = true;
					break;
				}
			}
		}

		return {
			status: TestResultType.success,
			output: 'All difficulties have the same number of moves in the first measure',
		};
	} catch (error) {
		return {
			status: TestResultType.error,
			output: `First measure check failed: ${error}`,
		};
	}
}
