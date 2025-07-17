import { createContext, useContext, useState, ReactNode } from 'react';

type EditorSection =
	| 'moves-library'
	| 'move-choreography'
	| 'camera-shots'
	| 'practice-sections'
	| null;

interface EditorContextType {
	activeSection: EditorSection;
	setActiveSection: (section: EditorSection) => void;
}

const EditorContext = createContext<EditorContextType | undefined>(undefined);

export function EditorProvider({ children }: { children: ReactNode }) {
	const [activeSection, setActiveSection] = useState<EditorSection>(null);

	return (
		<EditorContext.Provider value={{ activeSection, setActiveSection }}>
			{children}
		</EditorContext.Provider>
	);
}

export function useEditor() {
	const context = useContext(EditorContext);
	if (context === undefined) {
		throw new Error('useEditor must be used within an EditorProvider');
	}
	return context;
}
