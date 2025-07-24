import { SongState } from '@/store/songStore';
import type { TestingUtils, TestResult } from '.';
import { TestResultType } from '@/types/song';

export async function isAnyCameraAtMeasureZero(
	song: SongState,
	utils: TestingUtils
): Promise<TestResult> {
	const cameras = song.currentSong?.timeline?.easy?.cameras ?? [];

	const found = cameras.some((cam) => cam.beat === 1);

	if (found) {
		return {
			status: TestResultType.error,
			output: 'There is at least one camera event at beat 1.',
		};
	}

	return {
		status: TestResultType.success,
		output: 'No camera events are at measure 1.',
	};
}
