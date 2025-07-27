import { SongState } from "@/store/songStore";
import type { TestingUtils, TestResult } from ".";
import { TestResultType } from "@/types/song";

// Helper to get choreography move for a given difficulty and measure
function getChoreoMoveForMeasure(song: SongState, difficulty: string, measure: number) {
  const moves = difficulty === "easy" ? song.currentSong?.timeline.easy.moves : difficulty === "medium" ? song.currentSong?.timeline.medium.moves : song.currentSong?.timeline.expert.moves;
  return moves?.find((m) => m.measure === measure);
}

// 1. Moves (by measure) can be used at most twice in all sections (per difficulty)
export async function arePracticeMovesUsedAtMostTwice(song: SongState, utils: TestingUtils): Promise<TestResult> {
  const difficulties = [
    {
      name: "easy",
      sections: song.currentSong?.practice?.easy ?? [],
      choreo: song.currentSong?.timeline.easy.moves ?? [],
    },
    {
      name: "medium",
      sections: song.currentSong?.practice?.medium ?? [],
      choreo: song.currentSong?.timeline.medium.moves ?? [],
    },
    {
      name: "expert",
      sections: song.currentSong?.practice?.expert ?? [],
      choreo: song.currentSong?.timeline.expert.moves ?? [],
    },
  ];

  const errors: string[] = [];

  for (const diff of difficulties) {
    // Build a map: measure -> {move, clip}
    const measureToMoveClip: Record<number, { move: string; clip: string }> = {};
    for (const move of diff.choreo) {
      measureToMoveClip[move.measure] = {
        move: move.move,
        clip: move.clip,
      };
    }

    // Count usage of each move+clip pair in practice sections
    const moveClipCount: Record<string, number> = {};
    for (const section of diff.sections) {
      for (const measure of section) {
        const moveClip = measureToMoveClip[measure];
        if (!moveClip) continue;
        const key = `${moveClip.move}_${moveClip.clip}`;
        moveClipCount[key] = (moveClipCount[key] || 0) + 1;
      }
    }
    const overused = Object.entries(moveClipCount).filter(([, count]) => count > 2);
    if (overused.length > 0) {
      errors.push(`${diff.name}: moves+clips used more than twice: ${overused.map(([k, v]) => `${k} (${v} times)`).join(", ")}`);
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
    output: "No move+clip is used more than twice in any practice difficulty.",
  };
}

// 2. No gaps between moves in a section (measures must be consecutive)
export async function arePracticeSectionsConsecutive(song: SongState, utils: TestingUtils): Promise<TestResult> {
  const difficulties = [
    {
      name: "easy",
      sections: song.currentSong?.practice?.easy ?? [],
    },
    {
      name: "medium",
      sections: song.currentSong?.practice?.medium ?? [],
    },
    {
      name: "expert",
      sections: song.currentSong?.practice?.expert ?? [],
    },
  ];

  const errors: string[] = [];

  for (const diff of difficulties) {
    for (let s = 0; s < diff.sections.length; s++) {
      const measures = [...diff.sections[s]].sort((a, b) => a - b);
      for (let i = 1; i < measures.length; i++) {
        if (measures[i] !== measures[i - 1] + 1) {
          errors.push(`${diff.name} section ${s + 1} has a gap between measures ${measures[i - 1]} and ${measures[i]}`);
        }
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
    output: "All practice sections have consecutive measures.",
  };
}

// 3. Sections must be progressing (each section starts after the previous ends)
export async function arePracticeSectionsProgressing(song: SongState, utils: TestingUtils): Promise<TestResult> {
  const difficulties = [
    {
      name: "easy",
      sections: song.currentSong?.practice?.easy ?? [],
    },
    {
      name: "medium",
      sections: song.currentSong?.practice?.medium ?? [],
    },
    {
      name: "expert",
      sections: song.currentSong?.practice?.expert ?? [],
    },
  ];

  const errors: string[] = [];

  for (const diff of difficulties) {
    let lastEnd = 0;
    for (let s = 0; s < diff.sections.length; s++) {
      const measures = [...diff.sections[s]].sort((a, b) => a - b);
      if (measures.length === 0) continue;
      const first = measures[0];
      if (first <= lastEnd) {
        errors.push(`${diff.name} section ${s + 1} starts at measure ${first} but previous section ended at ${lastEnd}`);
      }
      lastEnd = measures[measures.length - 1];
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
    output: "All practice sections are progressing in measures.",
  };
}

// 4. Last section has to have finishing pose as the last element
export async function isLastPracticeSectionFinishing(song: SongState, utils: TestingUtils): Promise<TestResult> {
  const difficulties = [
    {
      name: "easy",
      sections: song.currentSong?.practice?.easy ?? [],
    },
    {
      name: "medium",
      sections: song.currentSong?.practice?.medium ?? [],
    },
    {
      name: "expert",
      sections: song.currentSong?.practice?.expert ?? [],
    },
  ];

  const errors: string[] = [];

  for (const diff of difficulties) {
    const sections = diff.sections;
    if (sections.length === 0) continue;
    const lastSection = sections[sections.length - 1];
    const measures = [...lastSection].sort((a, b) => a - b);
    if (measures.length === 0) continue;
    const lastMeasure = measures[measures.length - 1];
    const move = getChoreoMoveForMeasure(song, diff.name, lastMeasure);
    if (!move) {
      errors.push(`${diff.name}: No choreography move found for measure ${lastMeasure} in last practice section.`);
      continue;
    }
    const moveData = await utils.checkMove(song, move.move, move.move_song, move.move_origin);
    const flags = utils.decodeFlags(moveData.clips[move.clip].flags || 0);
    const isFinishing = flags.includes("final_pose") || moveData?.final_pose === true || moveData?.isFinishingMove === true;

    if (!isFinishing) {
      errors.push(`${diff.name}: Last move in the last practice section is not a finishing pose.`);
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
    output: "Last move in the last practice section is a finishing pose for each difficulty.",
  };
}

export async function isPracticeDifficultyHierarchyRespected(song: SongState, utils: TestingUtils): Promise<TestResult> {
  // Helper to get move+clip for a measure in a difficulty
  const getMoveClip = (difficulty: "easy" | "medium" | "expert", measure: number) => {
    const moves = difficulty === "easy" ? song.currentSong?.timeline.easy.moves : difficulty === "medium" ? song.currentSong?.timeline.medium.moves : song.currentSong?.timeline.expert.moves;
    const move = moves?.find((m) => m.measure === measure);
    return move ? `${move.move}:${move.clip}` : null;
  };

  const easySections = song.currentSong?.practice?.easy ?? [];
  const mediumSections = song.currentSong?.practice?.medium ?? [];
  const expertSections = song.currentSong?.practice?.expert ?? [];

  // Collect all move+clip keys used in easy and medium practice sections
  const easyKeys = new Set<string>();
  for (const section of easySections) {
    for (const measure of section) {
      const key = getMoveClip("easy", measure);
      if (key) easyKeys.add(key);
    }
  }
  const mediumKeys = new Set<string>();
  for (const section of mediumSections) {
    for (const measure of section) {
      const key = getMoveClip("medium", measure);
      if (key) mediumKeys.add(key);
    }
  }
  // Collect all move+clip keys used in expert practice sections
  const expertKeys = new Set<string>();
  for (const section of expertSections) {
    for (const measure of section) {
      const key = getMoveClip("expert", measure);
      if (key) expertKeys.add(key);
    }
  }

  const missing: string[] = [];
  const missingEasyInExpert = [...easyKeys].filter((k) => !expertKeys.has(k));
  if (missingEasyInExpert.length > 0) {
    missing.push(`expert is missing moves+clips from easy: ${missingEasyInExpert.join(", ")}`);
  }
  const missingMediumInExpert = [...mediumKeys].filter((k) => !expertKeys.has(k));
  if (missingMediumInExpert.length > 0) {
    missing.push(`expert is missing moves+clips from medium: ${missingMediumInExpert.join(", ")}`);
  }

  if (missing.length > 0) {
    return {
      status: TestResultType.error,
      output: `Practice difficulty hierarchy not respected: ${missing.join(" | ")}`,
    };
  }

  return {
    status: TestResultType.success,
    output: "Expert contains all moves+clips from easy and medium practice sections.",
  };
}
