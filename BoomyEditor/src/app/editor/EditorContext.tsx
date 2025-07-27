import { createContext, useContext, useState, ReactNode, useRef, useCallback } from "react";

type EditorSection = "moves-library" | "move-choreography" | "camera-shots" | "practice-sections" | "song-data" | "drums" | "events" | "bam-phrases" | "visemes" | null;

interface EditorContextType {
  activeSection: EditorSection;
  setActiveSection: (section: EditorSection) => void;
  registerStopAudioCallback: (callback: () => void) => void;
  unregisterStopAudioCallback: () => void;
}

const EditorContext = createContext<EditorContextType | undefined>(undefined);

export function EditorProvider({ children }: { children: ReactNode }) {
  const [activeSection, setActiveSection] = useState<EditorSection>(null);
  const stopAudioCallbackRef = useRef<(() => void) | null>(null);

  const registerStopAudioCallback = useCallback((callback: () => void) => {
    stopAudioCallbackRef.current = callback;
  }, []);

  const unregisterStopAudioCallback = useCallback(() => {
    stopAudioCallbackRef.current = null;
  }, []);

  const setActiveSectionWithAudioStop = useCallback((section: EditorSection) => {
    // Stop audio playback if there's a callback registered
    if (stopAudioCallbackRef.current) {
      stopAudioCallbackRef.current();
    }
    setActiveSection(section);
  }, []);

  return (
    <EditorContext.Provider
      value={{
        activeSection,
        setActiveSection: setActiveSectionWithAudioStop,
        registerStopAudioCallback,
        unregisterStopAudioCallback,
      }}
    >
      {children}
    </EditorContext.Provider>
  );
}

export function useEditor() {
  const context = useContext(EditorContext);
  if (context === undefined) {
    throw new Error("useEditor must be used within an EditorProvider");
  }
  return context;
}
