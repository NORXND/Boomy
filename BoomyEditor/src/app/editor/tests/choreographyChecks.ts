import { SongState } from "@/store/songStore";
import type { TestingUtils, TestResult } from ".";
import { TestResultType } from "@/types/song";

// --- TESTS ---

export async function isFirstMeasureNotEmpty(song: SongState, utils: TestingUtils): Promise<TestResult> {
  const supereasy = song.currentSong?.supereasy.filter((move) => move.measure === 1);

  const easy = song.currentSong?.timeline.easy.moves.filter((move) => move.measure === 1);

  const medium = song.currentSong?.timeline.medium.moves.filter((move) => move.measure === 1);

  const expert = song.currentSong?.timeline.expert.moves.filter((move) => move.measure === 1);

  if (supereasy.length != 1 || easy.length != 1 || medium.length != 1 || expert.length != 1) {
    return {
      status: TestResultType.error,
      output: "First measure must have a move for each difficulty.",
    };
  }

  return {
    status: TestResultType.success,
    output: "First measure has a move for each difficulty.",
  };
}

export async function hasFinishingMove(song: SongState, utils: TestingUtils): Promise<TestResult> {
  const difficulties = [
    { name: "supereasy", moves: song.currentSong?.supereasy ?? [] },
    { name: "easy", moves: song.currentSong?.timeline.easy.moves ?? [] },
    {
      name: "medium",
      moves: song.currentSong?.timeline.medium.moves ?? [],
    },
    {
      name: "expert",
      moves: song.currentSong?.timeline.expert.moves ?? [],
    },
  ];

  const missing: string[] = [];

  for (const diff of difficulties) {
    if (!diff.moves.length) {
      missing.push(diff.name);
      continue;
    }
    const sorted = [...diff.moves].sort((a, b) => a.measure - b.measure);
    const lastMeasure = sorted[sorted.length - 1].measure;
    const lastMoves = sorted.filter((m) => m.measure === lastMeasure);

    const hasFinishing = lastMoves.some(async (m) => {
      const moveData = await utils.checkMove(song, m.move, m.move_song, m.move_origin);
      const flags = utils.decodeFlags(moveData.clips[m.clip].flags || 0);
      // Accept either flag or move.json property
      return flags.includes("final_pose") || moveData?.final_pose === true || moveData?.isFinishingMove === true;
    });

    if (!hasFinishing) {
      missing.push(diff.name);
    }
  }

  if (missing.length > 0) {
    return {
      status: TestResultType.error,
      output: `Last move-containing measure is missing a finishing move in: ${missing.join(", ")}.`,
    };
  }

  return {
    status: TestResultType.success,
    output: "Last move-containing measure has a finishing move for each difficulty.",
  };
}

// 1. Rest moves must be at the beginning (except after finishing move)
export async function areRestsOnlyAtBeginningOrAfterFinishing(song: SongState, utils: TestingUtils): Promise<TestResult> {
  const difficulties = [
    { name: "supereasy", moves: song.currentSong?.supereasy ?? [] },
    { name: "easy", moves: song.currentSong?.timeline.easy.moves ?? [] },
    {
      name: "medium",
      moves: song.currentSong?.timeline.medium.moves ?? [],
    },
    {
      name: "expert",
      moves: song.currentSong?.timeline.expert.moves ?? [],
    },
  ];

  const errors: string[] = [];

  for (const diff of difficulties) {
    const moves = [...diff.moves].sort((a, b) => a.measure - b.measure || a.measure - b.measure);
    let foundScored = false;
    let foundFinishing = false;

    for (let i = 0; i < moves.length; i++) {
      const moveData = await utils.checkMove(song, moves[i].move, moves[i].move_song, moves[i].move_origin);
      const flags = utils.decodeFlags(moveData.clips[moves[i].clip].flags || 0);
      const isRest = !flags.includes("scored") && !moveData?.scored;
      const isFinishing = flags.includes("final_pose") || moveData?.final_pose === true || moveData?.isFinishingMove === true;

      if (isRest) {
        // If we've already found a scored move and not just after a finishing move, this is an error
        if (foundScored && !foundFinishing) {
          errors.push(`${diff.name}: Rest move at measure ${moves[i].measure}, beat ${moves[i].measure} is not at the beginning or after a finishing move.`);
        }
      } else {
        foundScored = true;
        foundFinishing = isFinishing;
        continue;
      }

      // Reset finishing flag after a rest
      if (!isRest) {
        foundFinishing = false;
      }
    }
  }

  if (errors.length > 0) {
    return {
      status: TestResultType.error,
      output: errors.join(" | "),
    };
  }

  return {
    status: TestResultType.success,
    output: "All rest moves are only at the beginning or after a finishing move.",
  };
}

export async function noScoredMovesAfterFinishing(song: SongState, utils: TestingUtils): Promise<TestResult> {
  const difficulties = [
    { name: "supereasy", moves: song.currentSong?.supereasy ?? [] },
    { name: "easy", moves: song.currentSong?.timeline.easy.moves ?? [] },
    {
      name: "medium",
      moves: song.currentSong?.timeline.medium.moves ?? [],
    },
    {
      name: "expert",
      moves: song.currentSong?.timeline.expert.moves ?? [],
    },
  ];

  const errors: string[] = [];

  for (const diff of difficulties) {
    const moves = [...diff.moves].sort((a, b) => a.measure - b.measure || a.measure - b.measure);
    let foundFinishing = false;

    for (let i = 0; i < moves.length; i++) {
      const moveData = await utils.checkMove(song, moves[i].move, moves[i].move_song, moves[i].move_origin);
      const flags = utils.decodeFlags(moveData.clips[moves[i].clip].flags || 0);
      const isScored = flags.includes("scored") || !!moveData?.scored;
      const isFinishing = flags.includes("final_pose") || moveData?.final_pose === true || moveData?.isFinishingMove === true;

      if (foundFinishing && isScored) {
        errors.push(`${diff.name}: Scored move at measure ${moves[i].measure}, beat ${moves[i].measure} appears after a finishing move.`);
      }

      if (isFinishing) {
        foundFinishing = true;
      }
    }
  }

  if (errors.length > 0) {
    return {
      status: TestResultType.error,
      output: errors.join(" | "),
    };
  }

  return {
    status: TestResultType.success,
    output: "No scored moves appear after a finishing move.",
  };
}

export async function isDifficultyHierarchyRespected(song: SongState, utils: TestingUtils): Promise<TestResult> {
  const easy = song.currentSong?.timeline.easy.moves ?? [];
  const medium = song.currentSong?.timeline.medium.moves ?? [];
  const expert = song.currentSong?.timeline.expert.moves ?? [];

  // Helper to create a unique key for a move (by move name and clip)
  const moveKey = (m: any) => `${m.move}:${m.clip}`;

  const missing: string[] = [];

  const expertKeys = new Set(expert.map(moveKey));

  const easyKeys = new Set(easy.map(moveKey));
  const missingEasyInExpert = [...easyKeys].filter((k) => !expertKeys.has(k));
  if (missingEasyInExpert.length > 0) {
    missing.push(`expert is missing moves+clips from easy: ${missingEasyInExpert.join(", ")}`);
  }

  const mediumKeys = new Set(medium.map(moveKey));
  const missingMediumInExpert = [...mediumKeys].filter((k) => !expertKeys.has(k));
  if (missingMediumInExpert.length > 0) {
    missing.push(`expert is missing moves+clips from medium: ${missingMediumInExpert.join(", ")}`);
  }

  if (missing.length > 0) {
    return {
      status: TestResultType.warning,
      output: `Expert does not contain all moves+clips from lower difficulties: ${missing.join(" | ")}`,
    };
  }

  return {
    status: TestResultType.success,
    output: "Expert contains all moves+clips from easy and medium.",
  };
}
