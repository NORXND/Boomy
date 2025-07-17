import {
	Sidebar,
	SidebarContent,
	SidebarFooter,
	SidebarGroup,
	SidebarHeader,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
} from '@/components/ui/sidebar';
import { useEditor } from './EditorContext';
import { useSongName, useSongStore } from '@/store/songStore';
import { toast } from 'sonner';

export function EditorSidebar() {
	const { activeSection, setActiveSection } = useEditor();
	const songName = useSongName();
	const {
		saveSong,
		buildAndSave,
		currentSong,
		audioPath,
		isLoading: isSaving,
	} = useSongStore();

	const handleSave = () => {
		if (currentSong && !isSaving) {
			saveSong();
		}
	};

	const handleBuildAndSave = () => {
		if (currentSong && !isSaving) {
			buildAndSave();
		}
	};

	const handleSectionClick = (section: string) => {
		const typedSection = section as
			| 'moves-library'
			| 'move-choreography'
			| 'camera-shots'
			| 'practice-sections';
		setActiveSection(activeSection === typedSection ? null : typedSection);
	};

	const handleGenerateAudio = async () => {
		try {
			const result = await window.electronAPI.convertToMogg(audioPath);
			toast.success(`Converted successfully`, {
				description: `Output: ${result.outputPath}`,
			});
		} catch (error) {
			toast.error(`Error converting to MOGG`, {
				description: error.toString(),
			});
		}
	};

	return (
		<Sidebar>
			<SidebarHeader>
				<SidebarMenu>
					<SidebarMenuItem>
						<h1 className="font-bold">{songName}</h1>
					</SidebarMenuItem>
				</SidebarMenu>
			</SidebarHeader>
			<SidebarContent>
				<SidebarGroup>
					<SidebarMenu>
						<SidebarMenuItem>
							<SidebarMenuButton disabled>
								Song Data (TODO)
							</SidebarMenuButton>
							<SidebarMenuButton
								onClick={() =>
									window.electronAPI.openExternal(
										'https://signal.vercel.app/edit'
									)
								}
							>
								MIDI Editor (Signal)
							</SidebarMenuButton>
							<SidebarMenuButton disabled>
								Art Cover (TODO)
							</SidebarMenuButton>
							<SidebarMenuButton onClick={handleGenerateAudio}>
								Make Audio (MOGG)
							</SidebarMenuButton>
						</SidebarMenuItem>
					</SidebarMenu>
				</SidebarGroup>
				<SidebarGroup>
					<SidebarMenu>
						<SidebarMenuItem>
							<SidebarMenuButton
								onClick={() =>
									handleSectionClick('moves-library')
								}
								className={
									activeSection === 'moves-library'
										? 'bg-accent'
										: ''
								}
							>
								Moves Library
							</SidebarMenuButton>
							<SidebarMenuButton
								onClick={() =>
									handleSectionClick('move-choreography')
								}
								className={
									activeSection === 'move-choreography'
										? 'bg-accent'
										: ''
								}
							>
								Move Choreography
							</SidebarMenuButton>
							<SidebarMenuButton
								onClick={() =>
									handleSectionClick('camera-shots')
								}
								className={
									activeSection === 'camera-shots'
										? 'bg-accent'
										: ''
								}
							>
								Camera Shots
							</SidebarMenuButton>
							<SidebarMenuButton
								disabled
								onClick={() =>
									handleSectionClick('practice-sections')
								}
								className={
									activeSection === 'practice-sections'
										? 'bg-accent'
										: ''
								}
							>
								Practice Sections (TODO)
							</SidebarMenuButton>
							<SidebarMenuButton disabled>
								Dancer Faces (TODO)
							</SidebarMenuButton>
							<SidebarMenuButton disabled>
								Battle Data (TODO)
							</SidebarMenuButton>
							<SidebarMenuButton disabled>
								Party Data (TODO)
							</SidebarMenuButton>
						</SidebarMenuItem>
					</SidebarMenu>
				</SidebarGroup>
				<SidebarGroup>
					<SidebarMenu>
						<SidebarMenuItem>
							<SidebarMenuButton
								size="lg"
								onClick={handleSave}
								disabled={!currentSong || isSaving}
							>
								<h1 className="font-bold">
									{isSaving ? 'Saving...' : 'Save'}
								</h1>
							</SidebarMenuButton>
							<SidebarMenuButton
								size="lg"
								onClick={handleBuildAndSave}
								disabled={!currentSong || isSaving}
							>
								<h1 className="font-bold">
									{isSaving ? 'Building...' : 'Build & Save'}
								</h1>
							</SidebarMenuButton>
						</SidebarMenuItem>
					</SidebarMenu>
				</SidebarGroup>
			</SidebarContent>
			<SidebarFooter />
		</Sidebar>
	);
}
