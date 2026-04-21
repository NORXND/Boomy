import { useState, useEffect } from "react";
import { Button } from "./components/ui/button";
import { OpenSong } from "./OpenSong";
import { RandomIdGenerator } from "./RandomIdGenerator";
import { toast } from "sonner";
import ImportSong from "./ImportSong";
import { NewSong } from "./NewSong";
import { PreferencesDialog } from "./PreferencesDialog";
import { loadPreferences } from "./lib/preferencesManager";
import { useNavigate } from "react-router";
import { openSong } from "./loaders/songLoader";
import { useSongStore } from "./store/songStore";

export function Homepage() {
  const [idGeneratorOpen, setIdGeneratorOpen] = useState(false);
  const [preferencesOpen, setPreferencesOpen] = useState(false);
  const [lastProjects, setLastProjects] = useState<string[]>([]);
  const navigate = useNavigate();
  const { loadSong } = useSongStore();

  useEffect(() => {
    loadLastProjects();
  }, [preferencesOpen]); // Reload when preferences dialog closes

  const loadLastProjects = async () => {
    try {
      const prefs = await loadPreferences();
      setLastProjects(prefs.lastOpenedProjects || []);
    } catch (error) {
      console.error("Failed to load last projects:", error);
    }
  };

  const handleOpenLastProject = async (projectPath: string) => {
    try {
      const song = await openSong(projectPath);
      if (song) {
        loadSong(song.songData, song.songPath, song.songName);
        navigate("/editor");
      }
    } catch (error) {
      toast.error("Failed to open project", {
        description: String(error),
      });
      console.error(error);
    }
  };

  const handleClearHistory = async () => {
    if (!confirm("Are you sure you want to clear project history?")) {
      return;
    }
    const prefs = await loadPreferences();
    prefs.lastOpenedProjects = [];
    // Need to use invoke directly or add a function for this
    await window.electronAPI.invoke(
      "prefs:save",
      `pref1\n${JSON.stringify(prefs, null, 2)}`,
    );
    setLastProjects([]);
    toast.success("Project history cleared");
  };

  return (
    <div className="max-w-7xl mx-auto p-16">
      <div className="flex flex-row gap-4 justify-between items-start">
        <div className="flex flex-row gap-4">
          <img src="Boombox.svg" alt="Boombox" className="h-24" />
          <h1 className="text-8xl font-bold">Boomy</h1>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setPreferencesOpen(true)}
        >
          Preferences
        </Button>
      </div>
      <h2 className="text-4xl">v0.5.0</h2>
      <div className="h-8"></div>
      <div className="flex gap-4">
        <RandomIdGenerator open={idGeneratorOpen} setOpen={setIdGeneratorOpen} />
        <NewSong></NewSong>
        <OpenSong></OpenSong>
        <ImportSong></ImportSong>
        <Button variant="secondary" onClick={() => setIdGeneratorOpen(true)}>
          Random ID Generator
        </Button>
      </div>

      {/* Last Projects Section */}
      {lastProjects.length > 0 && (
        <div className="h-8"></div>
      )}
      {lastProjects.length > 0 && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold text-gray-300">
              Last Opened Projects
            </h3>
            <Button
              onClick={handleClearHistory}
              variant="ghost"
              size="sm"
              className="text-gray-400 hover:text-gray-200"
            >
              Clear History
            </Button>
          </div>
          <div className="flex flex-col gap-2">
            {lastProjects.map((project, index) => (
              <Button
                key={index}
                onClick={() => handleOpenLastProject(project)}
                variant="outline"
                className="justify-start text-left text-gray-300 truncate"
                title={project}
              >
                {project.split(/[\\/]/).pop() || project}
              </Button>
            ))}
          </div>
        </div>
      )}

      <div className="h-8"></div>
      <div className="text-gray-300">
        <h1>Boomy, created by NORXND licensed under MIT.</h1>
        <h2>This software uses MiloLib created by ihatecompvir, xbox360-lib created by unknownv2 licensed by MIT as well as was based on many of other awesome open source tools. (Check the README!)</h2>
        <Button className="mt-4" variant="outline" onClick={() => window.electronAPI.openExternal("https://github.com/NORXND/Boomy/")}>
          GitHub (Issues, Contribution)
        </Button>
      </div>

      <PreferencesDialog
        open={preferencesOpen}
        setOpen={setPreferencesOpen}
      />
    </div>
  );
}
