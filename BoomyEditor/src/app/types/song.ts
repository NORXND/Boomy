export interface MoveEvent {
	beat: number;
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
	audioPath: string;
	midiPath: string;
	moveLibrary: Record<string, string[]>; // moveKey -> clipPaths[]
}
