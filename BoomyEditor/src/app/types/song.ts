export interface MoveEvent {
	measure: number;
	clip: string;
	move_origin: string;
	move_song: string;
	move: string;
}

export enum CameraPosition {
	Venue = 'VENUE',
	Closeup = 'CLOSEUP',
	Area1Near = 'Area1_NEAR',
	Area1Movement = 'Area1_MOVEMENT',
	Area1Wide = 'Area1_WIDE',
	Area1Far = 'Area1_FAR',
	Area2Near = 'Area2_NEAR',
	Area2Movement = 'Area2_MOVEMENT',
	Area2Wide = 'Area2_WIDE',
	Area2Far = 'Area2_FAR',
	Area3Near = 'Area3_NEAR',
	Area3Movement = 'Area3_MOVEMENT',
	Area3Wide = 'Area3_WIDE',
	Area3Far = 'Area3_FAR',
}

export interface CameraEvent {
	beat: number;
	camera: CameraPosition;
}

// Timeline format for saving to JSON (matches C# model)
export interface TimelineForSave {
	easy: {
		moves: MoveEvent[];
		cameras: CameraEventForSave[];
	};
	medium: {
		moves: MoveEvent[];
		cameras: CameraEventForSave[];
	};
	expert: {
		moves: MoveEvent[];
		cameras: CameraEventForSave[];
	};
}

export interface CameraEventForSave {
	beat: number;
	position: CameraPosition; // C# model uses "position" instead of "camera"
}

export interface TempoChange {
	tick: number;
	bpm: number;
}

// PracticeSection now contains beats (measures) of selected moves, not indices
export type PracticeSection = number[]; // each number is a beat (measure) of a move in the timeline

export interface DrumsEvent {
	sound: string;
	events: number[];
}

export interface SongEvent {
	beat: number;
	type:
		| 'music_start'
		| 'preview'
		| 'freestyle_start'
		| 'freestyle_end'
		| 'music_end'
		| 'end';
}

export interface PartyJumpEvent {
	measure: number;
	type: 'start' | 'end';
}

export interface BattleEvent {
	beat: number;
	type:
		| 'player1_solo_start'
		| 'player1_solo_end'
		| 'player2_solo_start'
		| 'player2_solo_end'
		| 'minigame_start'
		| 'minigame_end';
}

export interface BamPhrase {
	count: number;
	bars: number;
}

export interface Song {
	move_lib: string;
	timeline: {
		easy: {
			moves: MoveEvent[];
			cameras: CameraEvent[];
		};
		medium: {
			moves: MoveEvent[];
			cameras: CameraEvent[];
		};
		expert: {
			moves: MoveEvent[];
			cameras: CameraEvent[];
		};
	};
	practice: {
		easy: PracticeSection[];
		medium: PracticeSection[];
		expert: PracticeSection[];
	};
	supereasy: MoveEvent[];
	drums: DrumsEvent[];
	events: SongEvent[];
	partyJumps: PartyJumpEvent[];
	battleSteps: BattleEvent[];
	bamPhrases: BamPhrase[];
	audioPath: string;
	tempoChanges: TempoChange[];
	moveLibrary: Record<string, string[]>; // moveKey -> clipPaths[]
	meta?: SongMeta; // Song metadata
	moveLibRev?: string;
}

export enum TestResultType {
	success,
	warning,
	error,
	skipped,
}

export type TestResult = {
	status: TestResultType;
	output: string;
};

export enum GameOrigin {
	DanceCentral3 = 'ham3',
	DanceCentral3DLC = 'ham3_dlc',
	DanceCentral2 = 'ham2',
	DanceCentral2DLC = 'ham2_dlc',
	DanceCentral1 = 'ham1',
	DanceCentral1DLC = 'ham1_dlc',
}

export enum Gender {
	Male = 'kGenderMale',
	Female = 'kGenderFemale',
}

export enum Venue {
	FreeSkate = 'rollerrink',
	ToprockAve = 'streetside',
	Studio675 = 'dclive',
	DCIHQ = 'dci',
	CrowsNest = 'throneroom',
}

export enum Character {
	// Angel
	AngelCrewLook = 'angel01',
	AngelStreetStyle = 'angel02',
	AngelDCClassic = 'angel03',
	AngelRetroFitted = 'angel04',
	AngelDCIAgent = 'angel05',
	// Emilia
	EmiliaCrewLook = 'emilia01',
	EmiliaStreetStyle = 'emilia02',
	EmiliaDCClassic = 'emilia03',
	EmiliaRetroFitted = 'emilia04',
	EmiliaDCIAgent = 'emilia05',
	// Mo
	MoCrewLook = 'mo01',
	MoStreetStyle = 'mo02',
	MoDCClassic = 'mo03',
	MoRetroFitted = 'mo04',
	MoDCIAgent = 'mo05',
	// Taye
	TayeCrewLook = 'taye01',
	TayeStreetStyle = 'taye02',
	TayeDCClassic = 'taye03',
	TayeRetroFitted = 'taye04',
	TayeDCIAgent = 'taye05',
	// Aubrey
	AubreyCrewLook = 'aubrey01',
	AubreyStreetStyle = 'aubrey02',
	AubreyDCClassic = 'aubrey03',
	AubreyRetroFitted = 'aubrey04',
	AubreyDCIAgent = 'aubrey05',
	// Bodie
	BodieCrewLook = 'bodie01',
	BodieStreetStyle = 'bodie02',
	BodieRetroFitted = 'bodie04',
	BodieDCIAgent = 'bodie05',
	// Glitch
	GlitchCrewLook = 'glitch01',
	GlitchStreetStyle = 'glitch02',
	GlitchRetroFitted = 'glitch04',
	GlitchDCIAgent = 'glitch05',
	// Lilt
	LiltCrewLook = 'lilt01',
	LiltStreetStyle = 'lilt02',
	LiltRetroFitted = 'lilt04',
	LiltDCIAgent = 'lilt05',
	// Dare
	DareDCClassic = 'dare04',
	DareUnderControl = 'dare06',
	// Maccoy
	MaccoyDCClassic = 'maccoy04',
	MaccoyUnderControl = 'maccoy06',
	// Oblio
	OblioCrewLook = 'oblio04',
	OblioUnderControl = 'oblio06',
	// Tan
	TanLikeABoss = 'tan01',
	TanCrewLook = 'tan04',
	// Ninjaman
	NinjamanCrewLook = 'ninjaman01',
	// Ninjawoman
	NinjawomanCrewLook = 'ninjawoman01',
	// Iconmanblue
	IconmanblueCrewLook = 'iconmanblue01',
	// Iconmanpink
	IconmanpinkCrewLook = 'iconmanpink01',
	// Robota
	RobotaCrewLook = 'robota01',
	RobotaDamaged = 'robota02',
	// Robotb
	RobotbCrewLook = 'robotb01',
	RobotbDamaged = 'robotb02',
	// Jaryn
	JarynCrewLook = 'jaryn01',
	JarynStreetStyle = 'jaryn02',
	JarynHauteBlooded = 'jaryn04',
	// Kerith
	KerithCrewLook = 'kerith01',
	KerithStreetStyle = 'kerith02',
	KerithHauteBlooded = 'kerith04',
	// Lima
	LimaDCIAgent = 'lima05',
	LimaUnderControl = 'lima06',
	// Rasa
	RasaDCIAgent = 'rasa05',
	RasaUnderControl = 'rasa06',
}

export enum Difficulty {
	Easy = 'Easy',
	Medium = 'Medium',
	Expert = 'Expert',
	Beginner = 'Beginner',
}

export interface SongMeta {
	name: string;
	artist: string;
	songid: number;
	game_origin: GameOrigin;
	song: SongTracks;
	preview: Preview;
	rank: number;
	album_name: string;
	gender: Gender;
	midi_events: MidiEvent[];
	default_character: Character;
	default_character_alt: Character;
	backup_character: Character;
	backup_character_alt: Character;
	default_venue: Venue;
	backup_venue: Venue;
	dj_intensity_rank: number;
	year_released: number;
	bpm: number;
	cover_image_path?: string; // Optional path to cover image PNG file
}

export interface MidiEvent {
	key: string;
	sound: string;
}

export interface Preview {
	start: number;
	end: number;
}

export interface SongTracks {
	tracks: Track[];
	pans: PansVols;
	vols: PansVols;
}

export interface PansVols {
	val1: number;
	val2: number;
}

export interface Track {
	name: string;
	start: number;
	end: number;
}

export interface SearchIndex {
	games: {
		name: string;
		song_count: number;
		move_count: number;
	}[];

	songs: {
		name: string;
		game: string;
		move_count: number;
		moves: string[];
	};

	moves: {
		name: string;
		song: string;
		game: string;
	}[];

	games_by_name: {
		[key: string]: {
			name: string;
			song_count: number;
			move_count: number;
		};
	};

	songs_by_name: {
		[key: string]: {
			name: string;
			song_count: number;
			move_count: number;
			moves: string[];
		};
	};

	moves_by_name: {
		[key: string]: {
			name: string;
			song: string;
			game: string;
		};
	};

	stats: {
		total_games: number;
		total_songs: number;
		total_moves: number;
	};
}
