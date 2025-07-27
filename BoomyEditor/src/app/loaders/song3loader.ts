import { BattleEvent, SongEvent } from "@/types/song";
import path from "path-browserify";
import { toast } from "sonner";

function getLastPathSegment(path: string): string {
  return path.replace(/\\/g, "/").split("/").filter(Boolean).pop() || "";
}

export default async function loadSong3(songPath: string, imported: boolean = false) {
  const songJSONExist = await window.electronAPI.pathExists(path.join(songPath, "song.json"));

  if (!songJSONExist) {
    toast.error("Song corrupted!", {
      description: "song.json is missing in the directory.",
    });
  }

  const songJSON = await window.electronAPI.readFile(path.join(songPath, "song.json"));

  const song = JSON.parse(songJSON);

  const reportCorrupted = () => {
    toast.error("Song Corrupted!", {
      description: "Your song's data is corrupted or invalid!",
    });
  };

  // Checks
  if (!song.move_lib) {
    if (!imported) {
      reportCorrupted();
      return;
    } else {
      const movelibFolder = await window.electronAPI.selectDirectoryPath({
        title: "Select Milo Move Library folder",
      });
      if (!movelibFolder) return;
      const resolvedDest = Array.isArray(movelibFolder) ? movelibFolder[0] : movelibFolder;
      song.move_lib = resolvedDest;
    }
  }

  // Move library check
  const moveLibExists = await window.electronAPI.pathExists(path.join(song.move_lib, ".boomy"));

  if (!moveLibExists) {
    toast.error("Move Library not found!", {
      description: "Please select a valid Milo Move Library folder.",
    });
    return;
  }

  const moveLibContent = await window.electronAPI.readFile(path.join(song.move_lib, ".boomy"));

  if (moveLibContent !== "mlib2") {
    toast.error("Unsupported Move Library version!", {
      description: "Please select a Milo Move Library v2.",
    });
    return;
  }

  if (!song.timeline) {
    reportCorrupted();
    return;
  }

  if (!song.timeline.easy) {
    reportCorrupted();
    return;
  }

  if (!song.timeline.easy.moves) {
    reportCorrupted();
    return;
  }

  if (!song.timeline.easy.cameras) {
    reportCorrupted();
    return;
  }

  if (!song.timeline.medium) {
    reportCorrupted();
    return;
  }

  if (!song.timeline.medium.moves) {
    reportCorrupted();
    return;
  }

  if (!song.timeline.medium.cameras) {
    reportCorrupted();
    return;
  }

  if (!song.timeline.expert) {
    reportCorrupted();
    return;
  }

  if (!song.timeline.expert.moves) {
    reportCorrupted();
    return;
  }

  if (!song.timeline.expert.cameras) {
    reportCorrupted();
    return;
  }

  if (!song.practice) {
    reportCorrupted();
    return;
  }

  if (!song.practice.easy) {
    reportCorrupted();
    return;
  }

  if (!song.practice.medium) {
    reportCorrupted();
    return;
  }

  if (!song.practice.expert) {
    reportCorrupted();
    return;
  }

  if (!song.moveLibrary) {
    reportCorrupted();
    return;
  }

  if (!song.supereasy) {
    reportCorrupted();
    return;
  }

  if (!song.practice.expert) {
    reportCorrupted();
    return;
  }

  if (!song.moveLibrary) {
    reportCorrupted();
    return;
  }

  if (!song.supereasy) {
    reportCorrupted();
    return;
  }

  if (!song.drums) {
    reportCorrupted();
    return;
  }

  if (!song.events) {
    reportCorrupted();
    return;
  }

  // We added support for dancer faces so it must be added
  if (!song.dancerFaces) {
    song.dancerFaces = {
      easy: [],
      medium: [],
      expert: [],
    };
  }

  if (!song.tempoChanges) {
    reportCorrupted();
    return;
  }

  if (!song.meta) {
    reportCorrupted();
    return;
  }

  if (!song.moveLibRev) {
    reportCorrupted();
    return;
  }

  if (song.moveLibRev !== "mlib2") {
    reportCorrupted();
    return;
  }

  // We dropped support for
  // Battle events: 'player1_solo_end' | 'player2_solo_end' | 'battle_start'
  // Song events: 'freestyle_end'

  function convertBattleEventType(type: string): string | null {
    switch (type) {
      case "player1_solo_start":
        return "player1_solo";
      case "player2_solo_start":
        return "player2_solo";
      case "player1_solo_end":
      case "player2_solo_end":
      case "battle_start":
        return "battle_reset";
      default:
        return type;
    }
  }

  function convertSongEventType(type: string): string | null {
    switch (type) {
      case "freestyle_start":
        return "freestyle";
      case "freestyle_end":
        return null;
      default:
        return type;
    }
  }

  if (song.battleSteps) {
    song.battleSteps = song.battleSteps
      .map((event: BattleEvent) => ({
        ...event,
        type: convertBattleEventType(event.type),
      }))
      .filter((event: BattleEvent) => event.type !== null);
  }

  if (song.partyBattleSteps) {
    song.partyBattleSteps = song.partyBattleSteps
      .map((event: BattleEvent) => ({
        ...event,
        type: convertBattleEventType(event.type),
      }))
      .filter((event: BattleEvent) => event.type !== null);
  }

  if (song.events) {
    song.events = song.events
      .map((event: SongEvent) => ({
        ...event,
        type: convertSongEventType(event.type),
      }))
      .filter((event: SongEvent) => event.type !== null);
  }

  const dirName = getLastPathSegment(songPath);
  const oggPath = path.join(songPath, `${dirName}.ogg`);

  const oggExists = await window.electronAPI.pathExists(oggPath);

  if (!oggExists) {
    toast.error("Song Corrupted!", {
      description: "Sounds file (.ogg) is missing.",
    });
    return;
  }

  return {
    songData: song,
    songPath: songPath,
    songName: dirName,
  };
}
