import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { EditorSidebar } from './EditorSidebar';
import { EditorMenuBar } from './EditorMenuBar';
import { EditorProvider, useEditor } from './EditorContext';
import { MovesLibrary } from './MovesLibrary';
import { MoveChoreography } from './MoveChoreography';
import { CameraShots } from './CameraShots';
import { PracticeSections } from './PracticeSections';
import { useSongStore } from '../store/songStore';
import { useEffect } from 'react';
import { TimelineProvider } from '@/contexts/TimelineContext';
import MetadataEditor from './MetadataEditor';
import { DrumsEditor } from './DrumsEditor';
import { EventsEditor } from './EventsEditor';
import { BamPhrasesEditor } from './BamPhrasesEditor';
import { VisemesEditor } from './VisemesEditor';

const SECTION_NAMES = {
	'moves-library': 'Moves Library',
	'move-choreography': 'Move Choreography',
	'camera-shots': 'Camera Shots',
	'practice-sections': 'Practice Sections',
	'song-data': 'Song Data',
	drums: 'Drums Editor',
	events: 'Song Events',
	'bam-phrases': 'BAM Phrases',
	visemes: 'Dancer Faces Editor',
};

function EditorContent() {
	const { activeSection } = useEditor();
	const { saveSong, currentSong, isLoading: isSaving } = useSongStore();

	// Global keyboard shortcut for saving
	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			if (e.ctrlKey && e.key === 's') {
				e.preventDefault();
				if (currentSong && !isSaving) {
					saveSong();
				}
			}
		};

		window.addEventListener('keydown', handleKeyDown);
		return () => window.removeEventListener('keydown', handleKeyDown);
	}, [currentSong, isSaving, saveSong]);

	const renderActiveSection = () => {
		switch (activeSection) {
			case 'moves-library':
				return <MovesLibrary />;
			case 'move-choreography':
				return <MoveChoreography />;
			case 'camera-shots':
				return <CameraShots />;
			case 'drums':
				return <DrumsEditor />;
			case 'events':
				return <EventsEditor />;
			case 'practice-sections':
				return <PracticeSections />;
			case 'song-data':
				return <MetadataEditor />;
			case 'bam-phrases':
				return <BamPhrasesEditor />;
			case 'visemes':
				return <VisemesEditor />;
			default:
				return (
					<div className="flex-1 flex items-center justify-center text-muted-foreground">
						<p>Select a section from the sidebar to get started</p>
					</div>
				);
		}
	};

	return (
		<SidebarProvider>
			<EditorSidebar />
			<main className="flex-1 flex flex-col max-h-screen">
				{/* <div className="flex flex-row items-center p-2 gap-4 border-b border-gray-600">
					<EditorMenuBar />
					<h1>{SECTION_NAMES[activeSection]}</h1>
				</div> */}
				<TimelineProvider>{renderActiveSection()}</TimelineProvider>
			</main>
		</SidebarProvider>
	);
}

export function EditorRoot() {
	return (
		<EditorProvider>
			<EditorContent />
		</EditorProvider>
	);
}
