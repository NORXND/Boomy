using MiloLib;
using MiloLib.Assets;
using MiloLib.Assets.Ham;
using Newtonsoft.Json;
using MiloLib.Assets.Rnd;
using static MiloLib.Assets.DirectoryMeta;
using BCnEncoder.Decoder;
using BCnEncoder.ImageSharp;
using SixLabors.ImageSharp;
using Serilog;
using Serilog.Events;

namespace BoomyExporter
{
    public struct ClipData
    {
        [JsonProperty("avg_beats_per_second")]
        public float AvgBeatsPerSecond;

        [JsonProperty("genre")]
        public required string Genre;

        [JsonProperty("era")]
        public required string Era;

        [JsonProperty("flags")]
        public uint Flags;

        [JsonProperty("linked_to")]
        public required string LinkedTo;

        [JsonProperty("linked_from")]
        public required string LinkedFrom;
    }

    public struct MoveData
    {
        [JsonProperty("name")]
        public required string Name;

        [JsonProperty("difficulty")]
        public int Difficulty;

        [JsonProperty("display_name")]
        public required string DisplayName;

        [JsonProperty("ham_move_name")]
        public required string HamMoveName;

        [JsonProperty("milo_name")]
        public required string MiloName;

        [JsonProperty("song_name")]
        public required string SongName;

        [JsonProperty("clips")]
        public required Dictionary<string, ClipData> clips;

    }


    public class ExportOperator
    {
        public string InputPath { get; }
        public string OutputName { get; }
        public string Origin { get; }
        public bool Verbose { get; }
        public bool ExportBarks { get; }
        public bool ExportMoves { get; }
        public bool ExportMidiBanks { get; }
        public bool ExportBoomyProject { get; }
        public string SongName { get; set; }

        private readonly ILogger _logger;
        static List<string> languages = new List<string> { "cht", "deu", "dut", "eng", "esl", "fre", "ita", "jpn", "kor", "mex", "nor", "pol", "ptb", "rus", "swe" };

        public ExportOperator(string inputPath, string outputName, string songName, string origin, bool verbose, bool exportBarks = false, bool exportMoves = false, bool exportMidiBanks = false, bool exportBoomyProject = false)
        {
            InputPath = inputPath ?? throw new ArgumentNullException(nameof(inputPath));
            OutputName = outputName ?? throw new ArgumentNullException(nameof(outputName));
            SongName = songName ?? throw new ArgumentNullException(nameof(songName));
            Origin = origin ?? throw new ArgumentNullException(nameof(origin));
            Verbose = verbose;
            ExportBarks = exportBarks;
            ExportMoves = exportMoves;
            ExportMidiBanks = exportMidiBanks;
            ExportBoomyProject = exportBoomyProject;

            // Configure Serilog
            var logConfig = new LoggerConfiguration()
                .MinimumLevel.Is(verbose ? LogEventLevel.Debug : LogEventLevel.Information)
                .WriteTo.Console(
                    outputTemplate: "[{Timestamp:HH:mm:ss} {Level:u3}] {Message:lj}{NewLine}{Exception}",
                    theme: Serilog.Sinks.SystemConsole.Themes.AnsiConsoleTheme.Code
                );

            _logger = logConfig.CreateLogger();
        }

        private void LogInfo(string message) => _logger.Information("ℹ  {Message}", message);
        private void LogSuccess(string message) => _logger.Information("✅ {Message}", message);
        private void LogWarning(string message) => _logger.Warning("⚠️  {Message}", message);
        private void LogError(string message) => _logger.Error("❌ {Message}", message);
        private void LogDebug(string message) => _logger.Debug("🔍 {Message}", message);
        private void LogProgress(string message) => _logger.Information("⏳ {Message}", message);
        private void LogFileOperation(string operation, string path) => _logger.Information("📁 {Operation}: {Path}", operation, path);
        private void LogSectionStart(string section) => _logger.Information("🚀 === {Section} ===", section);
        private void LogSectionEnd(string section) => _logger.Information("🏁 === {Section} Complete ===", section);

        public void Export()
        {
            LogSectionStart("BOOMY EXPORT STARTED");
            LogInfo($"Song: {SongName}");
            LogInfo($"Input Path: {InputPath}");
            LogInfo($"Output: {OutputName}");
            LogInfo($"Export Options: Moves={ExportMoves}, Barks={ExportBarks}, MidiBanks={ExportMidiBanks}");

            LogProgress("Checking required song files...");
            bool filesOk = CheckSongFiles(SongName);

            if (!filesOk)
            {
                LogError("Required files are missing, aborting export");
                return;
            }

            LogSuccess("All required files found");

            if (ExportMoves)
            {
                LogSectionStart("MOVES EXPORT");

                string moveDataMiloFile = Path.Combine(InputPath, "gen", "move_data.milo_xbox");
                string mainMiloFile = Path.Combine(InputPath, "gen", $"{SongName}.milo_xbox");

                string miloFileToUse = null;
                MiloFile miloFile = null;

                if (File.Exists(moveDataMiloFile))
                {
                    LogProgress("Loading move_data milo file...");
                    miloFileToUse = moveDataMiloFile;
                    miloFile = new(moveDataMiloFile);
                    LogSuccess($"Loaded move_data milo file: {moveDataMiloFile}");
                }
                else if (File.Exists(mainMiloFile))
                {
                    LogWarning("move_data.milo_xbox not found, falling back to main milo file...");
                    LogProgress("Loading main milo file...");
                    miloFileToUse = mainMiloFile;
                    miloFile = new(mainMiloFile);
                    LogSuccess($"Loaded main milo file: {mainMiloFile}");
                }
                else
                {
                    LogError("Neither move_data.milo_xbox nor main milo file found");
                }

                if (miloFile != null)
                {
                    DirectoryMeta MoveDataDir = miloFile.dirMeta;
                    LogDebug($"Move data directory meta entries count: {MoveDataDir.entries.Count}");

                    ExportMovesToDirectory(miloFileToUse, MoveDataDir);
                }

                LogSectionEnd("MOVES EXPORT");
            }

            if (ExportMidiBanks)
            {
                LogSectionStart("MIDI BANKS EXPORT");

                string mainMiloFile = Path.Combine(InputPath, "gen", $"{SongName}.milo_xbox");
                if (!File.Exists(mainMiloFile))
                {
                    LogError($"Main milo file not found: {mainMiloFile}");
                }
                else
                {
                    LogProgress("Loading main milo file for MIDI banks...");
                    MiloFile mainMilo = null;
                    try
                    {
                        mainMilo = new(mainMiloFile);
                        LogSuccess($"Loaded main milo file: {mainMiloFile}");
                    }
                    catch (Exception ex)
                    {
                        LogError($"Failed to load main milo file: {mainMiloFile}. This could mean you tried to open DC1 file for midi bank export which is not supported. Error: {ex.ToString()}");
                    }

                    if (mainMilo != null)
                    {
                        MidiBanksExport(mainMiloFile, mainMilo.dirMeta);
                    }
                }

                LogSectionEnd("MIDI BANKS EXPORT");
            }

            LogSectionEnd("BOOMY EXPORT COMPLETED");
            LogSuccess($"Export completed successfully for {SongName}");
        }

        public bool CheckSongFiles(string songName)
        {
            string songDir = Path.Combine(InputPath);
            string midPath = Path.Combine(songDir, $"{songName}.mid");
            string moggPath = Path.Combine(songDir, $"{songName}.mogg");
            string genDir = Path.Combine(songDir, "gen");
            string moveDataMiloPath = Path.Combine(genDir, "move_data.milo_xbox");
            string mainMiloPath = Path.Combine(genDir, $"{songName}.milo_xbox");
            string pngPath = Path.Combine(genDir, $"{songName}_keep.png_xbox");

            bool allExist = true;

            LogDebug("Checking required files:");

            if (!File.Exists(midPath))
            {
                LogError($"Missing: {midPath}");
                allExist = false;
            }
            else
            {
                LogSuccess($"Found: {midPath}");
            }

            if (!File.Exists(moggPath))
            {
                LogError($"Missing: {moggPath}");
                allExist = false;
            }
            else
            {
                LogSuccess($"Found: {moggPath}");
            }

            if (!Directory.Exists(genDir))
            {
                LogError($"Missing directory: {genDir}");
                allExist = false;
            }
            else
            {
                LogSuccess($"Found directory: {genDir}");

                // Check for move data - either move_data.milo_xbox OR main milo
                bool hasMoveData = false;
                if (File.Exists(moveDataMiloPath))
                {
                    LogSuccess($"Found: {moveDataMiloPath}");
                    hasMoveData = true;
                }
                else if (File.Exists(mainMiloPath))
                {
                    LogSuccess($"Found main milo (fallback for moves): {mainMiloPath}");
                    hasMoveData = true;
                }

                if (!hasMoveData)
                {
                    LogError($"Missing move data: Neither {moveDataMiloPath} nor {mainMiloPath} found");
                    allExist = false;
                }

                // Check for main milo file (needed for MIDI banks)
                if (!File.Exists(mainMiloPath))
                {
                    LogWarning($"Missing: {mainMiloPath} - MIDI banks export will be unavailable");
                }
                else
                {
                    LogSuccess($"Found: {mainMiloPath}");
                }

                if (!File.Exists(pngPath))
                {
                    LogError($"Missing: {pngPath}");
                    allExist = false;
                }
                else
                {
                    LogSuccess($"Found: {pngPath}");
                }
            }

            if (!allExist)
            {
                LogWarning("Some required files or directories are missing");
            }

            return allExist;
        }

        async void ExportMovesToDirectory(string miloFile, DirectoryMeta dirMeta)
        {
            try
            {
                LogProgress("Finding MoveGraph...");

                // Check if we're using move_data.milo_xbox or main milo
                bool isUsingMoveDataFile = miloFile.EndsWith("move_data.milo_xbox");

                MoveGraph graph = null;
                DirectoryMeta moveDataDir = dirMeta;

                if (isUsingMoveDataFile)
                {
                    // move_data.milo_xbox should have the graph directly
                    graph = (MoveGraph)(dirMeta.entries.FirstOrDefault(static d => d.name == "move_graph")?.obj);
                    LogDebug("Using move_data.milo_xbox - looking for move_graph directly");
                }
                else
                {
                    // Main milo file - need to find moves directory first
                    LogDebug("Using main milo file - looking for moves directory");
                    Entry movesDir = dirMeta.entries.FirstOrDefault(static d => d.name == "moves");

                    if (movesDir == null)
                    {
                        LogError("moves directory not found in main milo file");
                        return;
                    }

                    Entry moveDataEntry = movesDir.dir.entries.FirstOrDefault(static d => d.name == "move_data");
                    if (moveDataEntry == null)
                    {
                        LogError("move_data directory not found in moves directory");
                        return;
                    }

                    moveDataDir = moveDataEntry.dir;
                    graph = (MoveGraph)(moveDataDir.entries.FirstOrDefault(static d => d.name == "move_graph")?.obj);
                    LogDebug("Found moves/move_data structure in main milo");
                }

                if (graph == null)
                {
                    LogError("move_graph obj not found");
                    return;
                }

                LogSuccess($"Found MoveGraph with {graph.moveParents.Count} move parents");

                int processedMoves = 0;
                int skippedMoves = 0;

                foreach (MoveParent moveParent in graph.moveParents.Values)
                {
                    try
                    {
                        if (moveParent.moveVariants.Count == 0)
                        {
                            LogWarning($"Skipping move parent {moveParent.name.value} (no variants)");
                            skippedMoves++;
                            continue;
                        }

                        LogProgress($"Processing move: {moveParent.name.value} ({moveParent.moveVariants.Count} variants)");

                        var clipDatas = new Dictionary<string, ClipData>();

                        foreach (MoveVariant variant in moveParent.moveVariants)
                        {
                            var clipData = new ClipData()
                            {
                                AvgBeatsPerSecond = variant.avgBeatsPerSecond,
                                Genre = variant.genre.value,
                                Era = variant.era.value,
                                Flags = variant.flags,
                                LinkedTo = variant.linkedTo.value,
                                LinkedFrom = variant.linkedFrom.value,
                            };
                            clipDatas.Add(variant.index.value, clipData);
                        }

                        var moveData = new MoveData()
                        {
                            Name = moveParent.name.value,
                            Difficulty = (int)moveParent.difficulty,
                            DisplayName = moveParent.displayName.value,
                            HamMoveName = moveParent.moveVariants[0].hamMoveName,
                            MiloName = moveParent.moveVariants[0].hamMoveMiloname,
                            SongName = moveParent.moveVariants[0].songName,
                            clips = clipDatas,
                        };

                        string moveSaveName = moveData.clips.Keys.First();
                        string[] parts = moveSaveName.Split('_');
                        moveSaveName = moveSaveName.Replace("_" + moveData.SongName, "");

                        string moveDir = Path.Combine(OutputName, "moves", moveSaveName);
                        try
                        {
                            // Empty the directory if it exists, then create it
                            if (Directory.Exists(moveDir))
                            {
                                Directory.Delete(moveDir, true);
                                LogDebug($"Emptied existing directory: {moveDir}");
                            }
                            Directory.CreateDirectory(moveDir);
                            LogFileOperation("Created directory", moveDir);
                        }
                        catch (Exception ex)
                        {
                            LogError($"Failed to create/empty directory {moveDir}: {ex.Message}");
                            continue;
                        }

                        string jsonPath = Path.Combine(moveDir, "move.json");
                        try
                        {
                            if (File.Exists(jsonPath))
                            {
                                LogDebug($"Found existing move.json, merging data...");
                                string existingJson = File.ReadAllText(jsonPath);
                                MoveData existingMoveData = JsonConvert.DeserializeObject<MoveData>(existingJson);

                                bool moveDataMatches = existingMoveData.Name == moveData.Name &&
                                                     existingMoveData.Difficulty == moveData.Difficulty &&
                                                     existingMoveData.DisplayName == moveData.DisplayName &&
                                                     existingMoveData.HamMoveName == moveData.HamMoveName &&
                                                     existingMoveData.MiloName == moveData.MiloName &&
                                                     existingMoveData.SongName == moveData.SongName;

                                if (!moveDataMatches)
                                {
                                    LogError($"MoveData mismatch in existing {jsonPath}. Expected: {moveData.Name}, Found: {existingMoveData.Name}");
                                    continue;
                                }

                                bool hasCollisions = false;
                                var mergedClips = new Dictionary<string, ClipData>(existingMoveData.clips);

                                foreach (var newClip in moveData.clips)
                                {
                                    if (mergedClips.ContainsKey(newClip.Key))
                                    {
                                        LogError($"Clip index collision for {newClip.Key} in {jsonPath}");
                                        hasCollisions = true;
                                    }
                                    else
                                    {
                                        mergedClips.Add(newClip.Key, newClip.Value);
                                        LogDebug($"Added new clip {newClip.Key} to existing move.json");
                                    }
                                }

                                if (hasCollisions)
                                {
                                    LogWarning($"Skipping move.json write due to clip collisions in {jsonPath}");
                                    continue;
                                }

                                moveData = new MoveData()
                                {
                                    Name = existingMoveData.Name,
                                    Difficulty = existingMoveData.Difficulty,
                                    DisplayName = existingMoveData.DisplayName,
                                    HamMoveName = existingMoveData.HamMoveName,
                                    MiloName = existingMoveData.MiloName,
                                    SongName = existingMoveData.SongName,
                                    clips = mergedClips
                                };

                                LogSuccess($"Merged {moveData.clips.Count - existingMoveData.clips.Count} new clips into existing move.json");
                            }

                            string json = JsonConvert.SerializeObject(moveData, Formatting.Indented);
                            File.WriteAllText(jsonPath, json);
                            LogFileOperation("Wrote move data JSON", jsonPath);
                        }
                        catch (Exception ex)
                        {
                            LogError($"Failed to write move data JSON: {ex.Message}");
                        }

                        // Export files with progress indicators
                        try
                        {
                            Entry hamMove = moveDataDir.entries.FirstOrDefault(d => d.name == moveData.HamMoveName) ?? throw new Exception($"{moveData.HamMoveName} not found in move data");
                            string hamMovePath = Path.Combine(moveDir, hamMove.name);
                            File.WriteAllBytes(hamMovePath, hamMove.objBytes.ToArray());
                            LogFileOperation("Wrote hamMove", hamMovePath);
                        }
                        catch (Exception ex)
                        {
                            LogError($"Failed to write hamMove: {ex.Message}");
                        }

                        try
                        {
                            Entry? dancerSequence = moveDataDir.entries.FirstOrDefault(d => d.name == $"{moveData.MiloName}.seq");
                            if (dancerSequence != null)
                            {
                                string seqPath = Path.Combine(moveDir, $"{moveData.MiloName}.seq");
                                File.WriteAllBytes(seqPath, dancerSequence.objBytes.ToArray());
                                LogFileOperation("Wrote sequence", seqPath);
                            }
                            else
                            {
                                LogWarning($"{moveData.MiloName}.seq not found in {miloFile}");
                            }
                        }
                        catch (Exception ex)
                        {
                            LogError($"Failed to write sequence: {ex.Message}");
                        }

                        try
                        {
                            Entry? tex = moveDataDir.entries.FirstOrDefault(d => d.name == $"{moveData.MiloName}.tex");
                            if (tex != null)
                            {
                                try
                                {
                                    RndTex texObj = (RndTex)tex.obj;
                                    var ddsBytes = texObj.bitmap.ConvertToImage();
                                    if (ddsBytes.Count > 0)
                                    {
                                        try
                                        {
                                            string pngPath = Path.Combine(moveDir, $"move.png");
                                            using var ddsStream = new MemoryStream([.. ddsBytes]);
                                            var decoder = new BcDecoder();
                                            using var image = decoder.DecodeToImageRgba32(ddsStream);
                                            await image.SaveAsPngAsync(pngPath);
                                            LogFileOperation("Converted and saved PNG", pngPath);
                                        }
                                        catch (Exception ex2)
                                        {
                                            LogWarning($"Failed to convert {moveData.MiloName}.tex to PNG: {ex2.Message}");
                                        }
                                    }
                                }
                                catch (Exception ex)
                                {
                                    LogError($"Failed to process tex object: {ex.Message}");
                                }
                                string texPath = Path.Combine(moveDir, $"{moveData.MiloName}.tex");
                                File.WriteAllBytes(texPath, tex.objBytes.ToArray());
                                LogFileOperation("Wrote tex", texPath);
                            }
                        }
                        catch (Exception ex)
                        {
                            LogError($"Failed to write tex: {ex.Message}");
                        }

                        try
                        {
                            Entry? smtex = moveDataDir.entries.FirstOrDefault(d => d.name == $"{moveData.MiloName}_sm.tex");
                            if (smtex != null)
                            {
                                string smtexPath = Path.Combine(moveDir, $"{moveData.MiloName}_sm.tex");
                                File.WriteAllBytes(smtexPath, smtex.objBytes.ToArray());
                                LogFileOperation("Wrote smtex", smtexPath);
                            }
                            else
                            {
                                LogWarning($"{moveData.MiloName}_sm.tex not found in {miloFile}");
                            }
                        }
                        catch (Exception ex)
                        {
                            LogError($"Failed to write smtex: {ex.Message}");
                        }

                        int clipCount = 0;
                        foreach (string clip in moveData.clips.Keys)
                        {
                            try
                            {
                                Entry charClip = moveDataDir.entries.FirstOrDefault(d => d.name == clip) ?? throw new Exception($"{clip} not found in {miloFile}");
                                string clipPath = Path.Combine(moveDir, clip);
                                File.WriteAllBytes(clipPath, charClip.objBytes.ToArray());
                                clipCount++;
                                LogDebug($"Wrote clip ({clipCount}/{moveData.clips.Count}): {clip}");
                            }
                            catch (Exception ex)
                            {
                                LogError($"Failed to write clip {clip}: {ex.Message}");
                            }
                        }

                        try
                        {
                            string boomyPath = Path.Combine(moveDir, ".boomy");
                            File.WriteAllText(boomyPath, "move1");
                            LogFileOperation("Wrote .boomy marker", boomyPath);
                        }
                        catch (Exception ex)
                        {
                            LogError($"Failed to write .boomy marker: {ex.Message}");
                        }

                        processedMoves++;
                        LogSuccess($"✨ Completed move: {moveParent.name.value} ({clipCount} clips)");
                    }
                    catch (Exception ex)
                    {
                        LogError($"Failed to process move parent {moveParent.name.value}: {ex.Message}");
                        skippedMoves++;
                    }
                }

                LogInfo($"📊 Moves Export Summary: {processedMoves} processed, {skippedMoves} skipped");

                // Export barks section with improved logging
                if (ExportBarks)
                {
                    LogSectionStart("BARKS EXPORT");
                    try
                    {
                        Dictionary<string, string> barks = FindBarksFiles(miloFile);
                        LogInfo($"Found barks for {barks.Count} languages");

                        foreach (string loc in barks.Keys)
                        {
                            try
                            {
                                LogProgress($"Processing barks for language: {loc}");
                                MiloFile milo = new MiloFile(barks[loc]);
                                int barkFilesCount = 0;

                                foreach (Entry entry in milo.dirMeta.entries)
                                {
                                    try
                                    {
                                        string barkDirectory = Path.Combine(OutputName, "barks", entry.name.value.Split('.')[0], loc);
                                        if (!Directory.Exists(barkDirectory))
                                        {
                                            Directory.CreateDirectory(barkDirectory);
                                            LogFileOperation("Created bark directory", barkDirectory);
                                        }
                                        string filePath = Path.Combine(barkDirectory, entry.name.value);
                                        if (!File.Exists(filePath))
                                        {
                                            File.WriteAllBytes(filePath, entry.objBytes.ToArray());
                                            barkFilesCount++;
                                        }
                                    }
                                    catch (Exception ex)
                                    {
                                        LogError($"Failed to write bark file {entry.name.value}: {ex.Message}");
                                    }
                                }
                                LogSuccess($"Exported {barkFilesCount} bark files for {loc}");
                            }
                            catch (Exception ex)
                            {
                                LogError($"Failed to process barks for loc {loc}: {ex.Message}");
                            }
                        }
                        LogSectionEnd("BARKS EXPORT");
                    }
                    catch (Exception ex)
                    {
                        LogError($"Fatal error in barks export: {ex.Message}");
                    }
                }
                else
                {
                    LogDebug("Skipping barks export (disabled)");
                }
            }
            catch (Exception ex)
            {
                LogError($"Fatal error in ExportMovesToDirectory: {ex.Message}");
            }
        }

        async void MidiBanksExport(string miloFile, DirectoryMeta dirMeta)
        {
            if (!ExportMidiBanks)
            {
                LogDebug("Skipping MIDI banks export (disabled)");
                return;
            }

            try
            {
                LogProgress("Finding MIDI banks...");
                Entry? midiBankEntry = dirMeta.entries.FirstOrDefault(static d => d.name == "midi_bank");
                if (midiBankEntry == null)
                {
                    LogError("midi_bank entry not found in milo file");
                    return;
                }

                string midiBankDir = Path.Combine(OutputName, "midi_bank");
                Directory.CreateDirectory(midiBankDir);
                LogFileOperation("Created MIDI bank directory", midiBankDir);

                int exportedBanks = 0;
                foreach (Entry bankEntry in midiBankEntry.dir.entries)
                {
                    if (bankEntry.name.value == "midi_song_level.fade")
                    {
                        continue; // Skip this specific file
                    }

                    string bankPath = Path.Combine(midiBankDir, bankEntry.name.value.Split('.')[0]);

                    if (!File.Exists(bankPath))
                    {
                        Directory.CreateDirectory(bankPath);
                    }

                    File.WriteAllBytes(Path.Combine(bankPath, bankEntry.name.value), bankEntry.objBytes.ToArray());
                    exportedBanks++;
                    LogDebug($"Exported MIDI bank: {bankEntry.name.value}");
                }
                LogSuccess($"Exported {exportedBanks} MIDI banks");
            }
            catch (Exception ex)
            {
                LogError($"Failed to export MIDI banks: {ex.Message}");
            }
        }

        Dictionary<string, string> FindBarksFiles(string miloFilePath)
        {
            var foundBarksFiles = new Dictionary<string, string>();
            try
            {
                string songName = Path.GetFileNameWithoutExtension(Path.GetDirectoryName(Path.GetDirectoryName(miloFilePath)));

                LogDebug($"Searching for barks files for song: {songName}");

                string songPath = Path.Combine(InputPath);
                if (!Directory.Exists(songPath))
                {
                    LogError($"Song directory not found in: {InputPath}");
                    return foundBarksFiles;
                }

                string locPath = Path.Combine(songPath, "loc");
                if (!Directory.Exists(locPath))
                {
                    LogWarning($"Loc directory not found in: {songPath}");
                    return foundBarksFiles;
                }

                LogDebug($"Found song directory: {songPath}");

                foreach (string language in languages)
                {
                    if (foundBarksFiles.ContainsKey(language))
                    {
                        continue;
                    }

                    string languagePath = Path.Combine(locPath, language, "gen", "barks.milo_xbox");

                    if (File.Exists(languagePath))
                    {
                        foundBarksFiles.Add(language, languagePath);
                        LogDebug($"Found barks for {language}: {languagePath}");
                    }
                }

                List<string> missingLanguages = languages.Except(foundBarksFiles.Keys).ToList();
                if (missingLanguages.Count > 0)
                {
                    LogWarning($"Missing barks files for languages: {string.Join(", ", missingLanguages)} for song: {songName}");
                }
            }
            catch (Exception ex)
            {
                LogError($"Error in FindBarksFiles: {ex.Message}");
            }
            return foundBarksFiles;
        }
    }
}