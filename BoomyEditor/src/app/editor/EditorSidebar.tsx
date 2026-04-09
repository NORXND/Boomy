import { Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarHeader, SidebarMenu, SidebarMenuButton, SidebarMenuItem } from "@/components/ui/sidebar";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { useEditor } from "./EditorContext";
import { useSongName, useSongPath, useSongStore } from "@/store/songStore";
import { toast } from "sonner";
import JSZip from "jszip";
import { dirname, join } from "path-browserify";
import { useState } from "react";
import { runAllTests, getTestIcon, allTestsPassed, TestResult } from "./tests";
import { ExperimentalFeaturesWarning, type ExperimentalFeatureLog } from "@/components/ExperimentalFeaturesWarning";
import { HamBuildDtaBuilder } from "@/utils/hambuildDtaBuilder";
import { loadPreferences } from "@/lib/preferencesManager";

export function EditorSidebar() {
  const { activeSection, setActiveSection } = useEditor();
  const songName = useSongName();
  const songPath = useSongPath();
  const { saveSong, currentSong, isLoading: isSaving, totalMeasures, clearSong } = useSongStore();

  const songStore = useSongStore.getState();

  // Build dialog state
  const [buildDialogOpen, setBuildDialogOpen] = useState(false);
  const [buildPath, setBuildPath] = useState("");
  const [compressOutput, setCompressOutput] = useState<"none" | "default" | "fallback">("default");
  const [performTestsBeforeBuilding, setPerformTestsBeforeBuilding] = useState(true);
  const [packageSong, setPackageSong] = useState(false); // disabled for now

  // Test state
  const [testResults, setTestResults] = useState<Record<string, TestResult> | null>(null);
  const [isRunningTests, setIsRunningTests] = useState(false);
  const [testsCompleted, setTestsCompleted] = useState(false);

  // Experimental features warning state
  const [experimentalFeaturesWarningOpen, setExperimentalFeaturesWarningOpen] = useState(false);
  const [experimentalFeatures, setExperimentalFeatures] = useState<ExperimentalFeatureLog[]>([]);
  const [pendingBuildPath, setPendingBuildPath] = useState<string | null>(null);
  const [pendingCompression, setPendingCompression] = useState<"none" | "default" | "fallback">("default");

  // HamBuild dialog state
  const [hamBuildDialogOpen, setHamBuildDialogOpen] = useState(false);
  const [hamBuildPath, setHamBuildPath] = useState("");
  const [runHamBuild, setRunHamBuild] = useState(false);
  const [hamBuildExePath, setHamBuildExePath] = useState("");

  const handleSave = () => {
    if (currentSong && !isSaving) {
      saveSong();
    }
  };

  const handleBuildDialog = () => {
    if (currentSong && !isSaving) {
      // Set default build path to song path + /build
      setBuildPath(join(songPath, "build"));
      // Reset test state when opening dialog
      setTestResults(null);
      setTestsCompleted(false);
      setBuildDialogOpen(true);
    }
  };

  const handleHamBuildDialog = async () => {
    if (currentSong && !isSaving) {
      // Set default output path to song directory (no subdirectory)
      setHamBuildPath(songPath);
      setRunHamBuild(false);
      
      // Load default hambuild executable path from preferences
      try {
        const prefs = await loadPreferences();
        setHamBuildExePath(prefs.defaultHambuildPath || "");
      } catch (error) {
        console.error("Failed to load preferences:", error);
        setHamBuildExePath("");
      }
      
      setHamBuildDialogOpen(true);
    }
  };

  const handleSelectHamBuildPath = async () => {
    const selectedPath = await window.electronAPI.selectDirectoryPath();
    if (selectedPath) {
      setHamBuildPath(selectedPath);
    }
  };

  const handleSelectHamBuildExe = async () => {
    const selectedPath = await window.electronAPI.selectFilePath({ fileTypes: [{ name: "Executable", extensions: ["exe"] }] });
    if (selectedPath) {
      setHamBuildExePath(selectedPath);
    }
  };

  const handleHamBuildConfirm = async () => {
    if (!hamBuildPath) {
      toast.error("Please select an output path");
      return;
    }

    if (runHamBuild && !hamBuildExePath) {
      toast.error("Please select HamBuild.exe path");
      return;
    }

    try {
      const { currentSong } = useSongStore.getState();
      if (!currentSong) return;

      useSongStore.getState().setLoading(true);
      toast.loading("Converting to HamBuild format...", { id: "hambuild" });

      // Save song first
      await useSongStore.getState().saveSong();

      // Get audio path and cover image path from store and song meta
      const { audioPath } = useSongStore.getState();
      const coverImagePath = currentSong.meta?.cover_image_path || null;

      // Generate DTA content from song data using HamBuildDtaBuilder
      const dtaBuilder = new HamBuildDtaBuilder(currentSong, audioPath || null, coverImagePath);
      const dtaContent = dtaBuilder.generateDta();

      // Call the HamBuild converter via IPC
      const result = await window.electronAPI.convertToHamBuild({
        songPath: songPath,
        songName: songName,
        outputPath: hamBuildPath,
        songData: {
          dta: dtaContent, // Pass the generated DTA content
        },
        runHamBuild: runHamBuild,
        hamBuildExePath: hamBuildExePath,
      });

      useSongStore.getState().setLoading(false);
      setHamBuildDialogOpen(false);

      if (result.success) {
        toast.success("HamBuild conversion completed!", {
          id: "hambuild",
          description: `Output: ${hamBuildPath}\nDTA file: ${result.dtaPath}`,
        });
      } else {
        throw new Error(result.error || "Unknown conversion error");
      }
    } catch (error) {
      const errorMsg = `Failed to convert to HamBuild: ${error}`;
      useSongStore.getState().setLoading(false);
      toast.error(errorMsg, { id: "hambuild" });
    }
  };

  const handleSelectBuildPath = async () => {
    const result = (await window.electronAPI.selectDirectoryPath({
      title: "Select Build Output Directory",
    })) as string | null;

    if (result) {
      setBuildPath(result);
    }
  };

  const scanForExperimentalFeatures = (): ExperimentalFeatureLog[] => {
    if (!currentSong) return [];

    const experimental: ExperimentalFeatureLog[] = [];

    // Scan all difficulty levels
    ["supereasy", "easy", "medium", "expert"].forEach((difficulty) => {
      const moves =
        difficulty === "supereasy"
          ? currentSong.supereasy
          : currentSong.timeline[difficulty as "easy" | "medium" | "expert"].moves;

      moves.forEach((move) => {
        if (move.experimentalFeatures && Object.keys(move.experimentalFeatures).length > 0) {
          const enabledFeatures = Object.entries(move.experimentalFeatures)
            .filter(([_, enabled]) => enabled)
            .map(([key, _]) => key);

          if (enabledFeatures.length > 0) {
            experimental.push({
              difficulty: difficulty as "supereasy" | "easy" | "medium" | "expert",
              measure: move.measure,
              move: move.move,
              features: enabledFeatures,
            });
          }
        }
      });
    });

    return experimental;
  };

  const handleBuildConfirm = async () => {
    if (!currentSong || !buildPath) return;

    try {
      // Check for experimental features
      const experimentalFeaturesList = scanForExperimentalFeatures();
      if (experimentalFeaturesList.length > 0) {
        setExperimentalFeatures(experimentalFeaturesList);
        setPendingBuildPath(buildPath);
        setPendingCompression(compressOutput);
        setExperimentalFeaturesWarningOpen(true);
        return;
      }

      // If tests should be run before building, run them first
      if (performTestsBeforeBuilding) {
        if (!testsCompleted) {
          // Run tests automatically
          setIsRunningTests(true);
          toast.loading("Running tests before building...", {
            id: "test-run",
          });

          const results = await runAllTests(songStore);
          setTestResults(results);
          setTestsCompleted(true);
          setIsRunningTests(false);

          const hasErrors = !allTestsPassed(results);
          if (hasErrors) {
            toast.error("Cannot build: tests failed with errors", {
              id: "test-run",
            });
            return;
          } else {
            toast.success("Tests passed! Proceeding with build...", {
              id: "test-run",
            });
          }
        } else {
          // Tests already completed, check if they passed
          if (testResults && !allTestsPassed(testResults)) {
            toast.error("Cannot build: tests failed with errors");
            return;
          }
        }
      }

      // Proceed with build
      await buildAndSaveWithCustomPath(buildPath, compressOutput);
    } catch (error) {
      toast.error("Build failed", {
        description: error.toString(),
      });
      setIsRunningTests(false);
    }
  };

  const handleExperimentalFeaturesContinue = async () => {
    if (!pendingBuildPath) return;

    try {
      // If tests should be run before building, run them first
      if (performTestsBeforeBuilding) {
        if (!testsCompleted) {
          // Run tests automatically
          setIsRunningTests(true);
          toast.loading("Running tests before building...", {
            id: "test-run",
          });

          const results = await runAllTests(songStore);
          setTestResults(results);
          setTestsCompleted(true);
          setIsRunningTests(false);

          const hasErrors = !allTestsPassed(results);
          if (hasErrors) {
            toast.error("Cannot build: tests failed with errors", {
              id: "test-run",
            });
            return;
          } else {
            toast.success("Tests passed! Proceeding with build...", {
              id: "test-run",
            });
          }
        } else {
          // Tests already completed, check if they passed
          if (testResults && !allTestsPassed(testResults)) {
            toast.error("Cannot build: tests failed with errors");
            return;
          }
        }
      }

      // Proceed with build
      await buildAndSaveWithCustomPath(pendingBuildPath, pendingCompression);
    } catch (error) {
      toast.error("Build failed", {
        description: error.toString(),
      });
      setIsRunningTests(false);
    }
  };

  // Utility to get audio duration in seconds (rounded)
  async function getAudioDurationSeconds(audioPath: string): Promise<number> {
    return new Promise(async (resolve, reject) => {
      try {
        // Read the audio file as buffer from electron
        const buffer = await window.electronAPI.readFileBuffer(audioPath);

        // Create a blob from the buffer
        const blob = new Blob([buffer], { type: "audio/ogg" });
        const audioUrl = URL.createObjectURL(blob);

        const audio = new window.Audio();
        audio.src = audioUrl;

        audio.addEventListener("loadedmetadata", () => {
          URL.revokeObjectURL(audioUrl); // Clean up the blob URL
          resolve(Math.round(audio.duration * 1000));
        });

        audio.addEventListener("error", (e) => {
          URL.revokeObjectURL(audioUrl); // Clean up the blob URL on error
          reject(new Error("Failed to load audio for duration"));
        });
      } catch (error) {
        reject(new Error(`Failed to read audio file: ${error}`));
      }
    });
  }

  const buildAndSaveWithCustomPath = async (customPath: string, compression: "none" | "default" | "fallback") => {
    const { currentSong, songPath, audioPath } = useSongStore.getState();

    if (!currentSong || !songPath) {
      toast.error("No song loaded to build");
      return;
    }

    try {
      useSongStore.getState().setLoading(true);
      toast.loading("Building and saving...", { id: "build-save" });

      // First save the song normally
      await useSongStore.getState().saveSong();

      // Convert timeline data to match C# model format
      const convertCameraEvents = (events: any[]) => {
        return events.map((event: any) => ({
          beat: event.beat,
          position: event.camera, // Convert "camera" field to "position"
        }));
      };

      const timelineForBuild = {
        easy: {
          moves: currentSong.timeline.easy.moves,
          cameras: convertCameraEvents(currentSong.timeline.easy.cameras),
        },
        medium: {
          moves: currentSong.timeline.medium.moves,
          cameras: convertCameraEvents(currentSong.timeline.medium.cameras),
        },
        expert: {
          moves: currentSong.timeline.expert.moves,
          cameras: convertCameraEvents(currentSong.timeline.expert.cameras),
        },
      };

      // --- Get audio duration and append to meta ---
      let songMetaWithLength = currentSong.meta;
      if (currentSong.meta && audioPath) {
        try {
          const duration = await getAudioDurationSeconds(audioPath);
          songMetaWithLength = {
            ...(currentSong.meta as any),
            song_length: duration,
          } as any;
        } catch (e) {
          toast.error("Could not determine song length from audio.");
        }
      }

      // Create BuildRequest format with custom path
      const buildRequest = {
        path: songPath,
        moves_path: currentSong.move_lib,
        out_path: customPath, // Use custom build path
        timeline: timelineForBuild,
        practice: currentSong.practice,
        tempo_change: currentSong.tempoChanges,
        supereasy: currentSong.supereasy,
        drums: currentSong.drums,
        events: currentSong.events,
        party_jumps: currentSong.partyJumps,
        battle_steps: currentSong.battleSteps,
        party_battle_steps: currentSong.partyBattleSteps,
        bam_phrases: currentSong.bamPhrases,
        dancer_faces: currentSong.dancerFaces,
        total_measures: totalMeasures,
        compress: compression,
        package: packageSong, // Always false for now
        song_meta: songMetaWithLength, // Pass meta with song_length
      };

      toast.loading("Calling BoomyBuilder...", { id: "build-save" });

      const buildResult = await window.electronAPI.callBoomyBuilder(buildRequest);

      useSongStore.getState().setLoading(false);

      if (buildResult.success) {
        toast.success("Build completed successfully!", {
          id: "build-save",
          description: `Output: ${customPath}`,
        });
      } else {
        throw new Error(buildResult.error || "Unknown build error");
      }
    } catch (error) {
      const errorMsg = `Failed to build song: ${error}`;
      useSongStore.getState().setLoading(false);
      toast.error(errorMsg, { id: "build-save" });
    }
  };

  const handleExportAndSave = async () => {
    if (!currentSong) return;
    try {
      // Save the song first
      await saveSong();
      const oggPath = join(songPath, `${songName}.ogg`);
      const songJsonPath = join(songPath, `song.json`);
      const boomyPath = join(songPath, `.boomy`);

      // Read the original song.json
      const songData = await window.electronAPI.readJsonFile(songJsonPath);
      // Create a copy with move_lib as empty string
      const songDataExport = { ...songData, move_lib: "" };

      // Read the other files as buffers
      const [ogg, boomy] = await Promise.all([window.electronAPI.readFileBuffer(oggPath), window.electronAPI.readFileBuffer(boomyPath)]);

      let pngBuffer: Uint8Array | null = null;

      // Handle cover image - check metadata first, then fallback to default naming
      let coverImagePath: string | null = null;
      if (songData.meta?.cover_image_path) {
        const metaCoverPath = songData.meta.cover_image_path;
        // Make absolute path if it's relative
        coverImagePath = metaCoverPath.includes(":") ? metaCoverPath : join(songPath, metaCoverPath);
      } else {
        // Fallback to default naming convention
        coverImagePath = join(songPath, `${songName}_keep.png`);
      }

      if (coverImagePath && (await window.electronAPI.pathExists(coverImagePath))) {
        pngBuffer = await window.electronAPI.readFileBuffer(coverImagePath);
      }

      // Create zip
      const zip = new JSZip();
      zip.file(`${songName}.ogg`, ogg);
      zip.file("song.json", JSON.stringify(songDataExport, null, 2));
      zip.file(".boomy", boomy);
      if (pngBuffer) {
        // Include the original PNG with the filename from metadata or default
        const pngFileName = songData.meta?.cover_image_path || `${songName}_keep.png`;
        zip.file(pngFileName, pngBuffer);
      }

      const zipBlob = await zip.generateAsync({ type: "uint8array" });

      // Prompt user for save location using Save As dialog
      const savePath = await window.electronAPI.selectSavePath({
        title: "Export & Save",
        fileTypes: [{ name: "ZIP", extensions: ["zip"] }],
        defaultPath: `${songName}_export.zip`,
      });
      if (!savePath) throw new Error("Export cancelled");
      await window.electronAPI.writeFileBuffer(savePath, zipBlob);

      toast.success("Exported & Saved!", {
        description: savePath,
      });
    } catch (error) {
      toast.error("Export & Save failed", {
        description: error.toString(),
      });
    }
  };

  const handleSectionClick = (section: string) => {
    const typedSection = section as "moves-library" | "move-choreography" | "camera-shots" | "practice-sections" | "drums" | "events" | "bam-phrases";
    setActiveSection(activeSection === typedSection ? null : typedSection);
  };

  function handleExit() {
    clearSong();
  }

  return (
    <>
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
                <SidebarMenuButton onClick={() => handleSectionClick("song-data")}>Song Metadata</SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroup>
          <SidebarGroup>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton onClick={() => handleSectionClick("moves-library")} className={activeSection === "moves-library" ? "bg-accent" : ""}>
                  Moves Library
                </SidebarMenuButton>
                <SidebarMenuButton onClick={() => handleSectionClick("move-choreography")} className={activeSection === "move-choreography" ? "bg-accent" : ""}>
                  Move Choreography
                </SidebarMenuButton>
                <SidebarMenuButton onClick={() => handleSectionClick("camera-shots")} className={activeSection === "camera-shots" ? "bg-accent" : ""}>
                  Camera Shots
                </SidebarMenuButton>
                <SidebarMenuButton onClick={() => handleSectionClick("practice-sections")} className={activeSection === "practice-sections" ? "bg-accent" : ""}>
                  Practice Sections (Experimental)
                </SidebarMenuButton>
                <SidebarMenuButton onClick={() => handleSectionClick("events")} className={activeSection === "events" ? "bg-accent" : ""}>
                  Song Events
                </SidebarMenuButton>
                <SidebarMenuButton onClick={() => handleSectionClick("drums")} className={activeSection === "drums" ? "bg-accent" : ""}>
                  Practice Drums (Slow Down Mode)
                </SidebarMenuButton>
                <SidebarMenuButton onClick={() => handleSectionClick("bam-phrases")} className={activeSection === "bam-phrases" ? "bg-accent" : ""}>
                  Bust a Move Phrases
                </SidebarMenuButton>
                <SidebarMenuButton onClick={() => handleSectionClick("visemes")} className={activeSection === "visemes" ? "bg-accent" : ""}>
                  Dancer Faces
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroup>
          <SidebarGroup>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton size="lg" onClick={handleSave} disabled={!currentSong || isSaving}>
                  <h1 className="font-bold">{isSaving ? "Saving..." : "Save"}</h1>
                </SidebarMenuButton>
                <SidebarMenuButton size="lg" onClick={handleBuildDialog} disabled={!currentSong || isSaving}>
                  <h1 className="font-bold">{isSaving ? "Building..." : "Build & Save"}</h1>
                </SidebarMenuButton>
                <SidebarMenuButton size="lg" onClick={handleExportAndSave} disabled={!currentSong}>
                  <h1 className="font-bold">Export & Save</h1>
                </SidebarMenuButton>
                <SidebarMenuButton size="lg" onClick={handleHamBuildDialog} disabled={!currentSong || isSaving}>
                  <h1 className="font-bold">Convert to HamBuild</h1>
                </SidebarMenuButton>
                <SidebarMenuButton size="lg" onClick={handleExit} disabled={!currentSong}>
                  <h1 className="font-bold">Exit (without saving)</h1>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroup>
        </SidebarContent>
        <SidebarFooter />
      </Sidebar>

      {/* HamBuild Dialog */}
      <Dialog open={hamBuildDialogOpen} onOpenChange={setHamBuildDialogOpen}>
        <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Convert to HamBuild</DialogTitle>
            <DialogDescription>Configure HamBuild export settings for your song.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            {/* Output Path Input */}
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="hamBuildPath" className="text-right">
                Output Path
              </Label>
              <div className="col-span-3 flex gap-2">
                <Input
                  id="hamBuildPath"
                  value={hamBuildPath}
                  onChange={(e) => setHamBuildPath(e.target.value)}
                  placeholder="Select output directory for DTA file..."
                  className="flex-1"
                />
                <Button onClick={handleSelectHamBuildPath} variant="outline">
                  Browse
                </Button>
              </div>
            </div>

            {/* Run HamBuild Checkbox */}
            <div className="flex items-center space-x-2">
              <Checkbox
                id="runHamBuild"
                checked={runHamBuild}
                onCheckedChange={(checked) => setRunHamBuild(checked === true)}
              />
              <Label htmlFor="runHamBuild">Run HamBuild after conversion</Label>
            </div>

            {/* HamBuild.exe Path Input */}
            {runHamBuild && (
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="hamBuildExePath" className="text-right">
                  HamBuild.exe
                </Label>
                <div className="col-span-3 flex gap-2">
                  <Input
                    id="hamBuildExePath"
                    value={hamBuildExePath}
                    onChange={(e) => setHamBuildExePath(e.target.value)}
                    placeholder="Path to HamBuild.exe..."
                    className="flex-1"
                  />
                  <Button onClick={handleSelectHamBuildExe} variant="outline">
                    Browse
                  </Button>
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setHamBuildDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleHamBuildConfirm} disabled={!hamBuildPath || (runHamBuild && !hamBuildExePath)}>
              Convert
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Build Dialog */}
      <Dialog open={buildDialogOpen} onOpenChange={setBuildDialogOpen}>
        <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Build & Save Song</DialogTitle>
            <DialogDescription>Configure build settings for your song.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            {/* Build Path Input */}
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="buildPath" className="text-right">
                Output Path
              </Label>
              <div className="col-span-3 flex gap-2">
                <Input id="buildPath" value={buildPath} onChange={(e) => setBuildPath(e.target.value)} placeholder="Select build output directory..." className="flex-1" />
                <Button onClick={handleSelectBuildPath} variant="outline">
                  Browse
                </Button>
              </div>
            </div>

            {/* Compression Type Selection */}
            <div className="flex items-center space-x-2">
              <Label htmlFor="compressionType">Compression</Label>
              <Select value={compressOutput} onValueChange={(value) => setCompressOutput(value as "none" | "default" | "fallback")}>
                <SelectTrigger id="compressionType" className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  <SelectItem value="default">Default</SelectItem>
                  <SelectItem value="fallback">Fallback</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Tests Before Building Checkbox */}
            <div className="flex items-center space-x-2">
              <Checkbox id="testsBeforeBuilding" checked={performTestsBeforeBuilding} onCheckedChange={(checked) => setPerformTestsBeforeBuilding(checked === true)} />
              <Label htmlFor="testsBeforeBuilding">Perform tests before building (default)</Label>
            </div>

            {/* Package Song Checkbox (disabled) */}
            <div className="flex items-center space-x-2">
              <Checkbox id="packageSong" checked={packageSong} onCheckedChange={(checked) => setPackageSong(checked === true)} />
              <Label htmlFor="packageSong">Package song</Label>
            </div>

            {/* Test Section */}
            {performTestsBeforeBuilding && (
              <div className="border-t pt-4">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-semibold">Tests</h3>
                </div>

                {testResults && (
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {Object.entries(testResults).map(([testName, result]) => (
                      <div key={testName} className="border rounded p-3">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-lg">{getTestIcon(result.status)}</span>
                          <span className="font-medium">{testName}:</span>
                        </div>
                        <div className="text-sm text-muted-foreground whitespace-pre-wrap ml-6">{result.output}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBuildDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleBuildConfirm} disabled={!buildPath || isRunningTests}>
              {isRunningTests ? "Testing..." : "Build"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Experimental Features Warning */}
      <ExperimentalFeaturesWarning
        open={experimentalFeaturesWarningOpen}
        onOpenChange={setExperimentalFeaturesWarningOpen}
        features={experimentalFeatures}
        onContinue={handleExperimentalFeaturesContinue}
      />
    </>
  );
}
