using BoomyBuilder.Builder.Models;
using BoomyBuilder.Builder.Models.Move;
using BoomyBuilder.Builder.SongMetadata;
using BoomyBuilder.Builder.Utils;
using MiloLib;
using MiloLib.Assets;
using MiloLib.Assets.Ham;
using MiloLib.Assets.Rnd;
using static BoomyBuilder.Builder.PracticeSectioner.PracticeSectioner;
using System.Threading.Tasks;
using BoomyBuilder.Builder.Drumer;

namespace BoomyBuilder.Builder
{
    public class BuildOperator
    {

        public BuildRequest.BuildRequest Request;
        public MiloFile? WorkingMilo;
        public DirectoryMeta? ClipsDir;
        public DirectoryMeta? MovesDir;
        public DirectoryMeta? MoveDataDir;
        public DirectoryMeta? EasyDir;
        public DirectoryMeta? MediumDir;
        public DirectoryMeta? ExpertDir;

        public BuildOperator(string request)
        {
            BuildRequest.BuildRequest? converted = BuildRequest.BuildRequest.FromJson(request) ?? throw new Exception("Invalid JSON request");
            Request = converted;
        }

        public async Task<string?> Build()
        {
            WorkingMilo = new MiloFile(Request.MiloTemplatePath);


            // Get input folder name for file naming
            string inputFolderName = Path.GetFileName(Request.Path);

            // Create output directory structure
            Directory.CreateDirectory(Request.OutPath);

            string songsDir = Path.Combine(Request.OutPath, "songs");

            // Create song subfolder
            string songDir = Path.Combine(songsDir, inputFolderName);
            Directory.CreateDirectory(songDir);

            // Create gen subfolder
            string genDir = Path.Combine(songDir, "gen");
            Directory.CreateDirectory(genDir);

            // Create loc subfolder
            string locDir = Path.Combine(songDir, "loc");
            Directory.CreateDirectory(locDir);


            // Find all dirs and objects
            ClipsDir = WorkingMilo.dirMeta.entries.First(static d => d.name == "clips").dir ?? throw new Exception("clips dir not found");
            MovesDir = WorkingMilo.dirMeta.entries.First(static d => d.name == "moves").dir ?? throw new Exception("moves dir not found");
            EasyDir = WorkingMilo.dirMeta.entries.First(static d => d.name == "easy").dir ?? throw new Exception("easy dir not found");
            RndPropAnim easyAnim = (RndPropAnim)(EasyDir.entries.First(static d => d.name == "song.anim").obj ?? throw new Exception("Easy song.anim not found"));
            MediumDir = WorkingMilo.dirMeta.entries.First(static d => d.name == "medium").dir ?? throw new Exception("medium dir not found");
            RndPropAnim mediumAnim = (RndPropAnim)(MediumDir.entries.First(static d => d.name == "song.anim").obj ?? throw new Exception("Medium song.anim not found"));
            ExpertDir = WorkingMilo.dirMeta.entries.First(static d => d.name == "expert").dir ?? throw new Exception("expert dir not found");
            RndPropAnim expertAnim = (RndPropAnim)(ExpertDir.entries.First(static d => d.name == "song.anim").obj ?? throw new Exception("Expert song.anim not found"));
            MoveDataDir = MovesDir.entries.First(static d => d.name == "move_data").dir ?? throw new Exception("move_data dir not found");
            MoveGraph graph = (MoveGraph)(MoveDataDir.entries.First(static d => d.name == "move_graph").obj ?? throw new Exception("move_graph obj not found"));
            HamSupereasyData superezData = (HamSupereasyData)(MovesDir.entries.First(static d => d.name == "HamSupereasyData.sup").obj ?? throw new Exception("HamSupereasyData.sup obj not found"));
            HamPartyJumpData partyJumpData = (HamPartyJumpData)(MovesDir.entries.First(static d => d.name == "HamPartyJumpData.jmp").obj ?? throw new Exception("HamPartyJumpData.jmp obj not found"));
            HamBattleData battleData = (HamBattleData)(MovesDir.entries.First(static d => d.name == "HamBattleData.btl").obj ?? throw new Exception("HamBattleData.btl obj not found"));
            HamBattleData partyBattleData = (HamBattleData)(MovesDir.entries.First(static d => d.name == "HamPartyBattleData.btl").obj ?? throw new Exception("HamPartyBattleData.btl obj not found"));

            List<HamMove> hamMoves = [];
            AssetsImporter.ImportAsset(Request, this, hamMoves);
            Barker.CreateBarks(hamMoves, this, locDir);
            List<MidiEvent> midiEvents = Drumer.Drumer.GenerateMidiEvents(this);
            MidiMaker.CreateMidi(this, midiEvents);
            Dictionary<Difficulty, Dictionary<int, Move>> choreography = ChoreoMaker.ChoreoMaker.ParseChoreography(this);
            Dictionary<Difficulty, Dictionary<int, CameraPosition>> camPositions = Camerator.Camerator.ParseCameraEvents(Request.Timeline);
            MoveGrapher.MoveGrapher.BuildMoveGraph(graph, choreography);
            Superez.CreateSuperez(superezData, choreography[Difficulty.Beginner]);
            PartyJumper.CreatePartyJumps(this, partyJumpData);

            Dictionary<Difficulty, List<PracticeStepResult>> practiceSections = CreatePracticeSection(this, MovesDir, MoveDataDir, choreography);
            BattleMaster.CreateBattle(Request.BattleSteps, battleData, Request.TotalMeasures);
            BattleMaster.CreateBattle(Request.PartyBattleSteps, partyBattleData, Request.TotalMeasures);

            Sequentioner.Sequentioner.CreateSequences(this, MovesDir, MoveDataDir, choreography, practiceSections);
            TempoMapConverter tempoMapConverter = new(tempoMap: Request.TempoChange);
            Animator.Animator.BuildSongAnim(easyAnim, mediumAnim, expertAnim, choreography, camPositions, practiceSections, tempoMapConverter);


            // Save milo file
            string miloOutputPath = Path.Combine(genDir, inputFolderName + ".milo_xbox");
            WorkingMilo.Save(miloOutputPath, Request.Compress ? MiloFile.Type.CompressedZlibAlt : MiloFile.Type.Uncompressed);

            // Copy .mogg file (required)
            string moggSourcePath = Path.Combine(Request.Path, inputFolderName + ".mogg");
            string oggSourcePath = Path.Combine(Request.Path, inputFolderName + ".ogg");
            string moggDestPath = Path.Combine(songDir, inputFolderName + ".mogg");
            if (File.Exists(moggSourcePath))
            {
                File.Copy(moggSourcePath, moggDestPath, true);
            }
            else
            {
                if (File.Exists(oggSourcePath))
                {
                    BoomyConverters.Mogg.MoggCreator.CreateMoggFile(oggSourcePath, moggDestPath);
                }
                else
                {
                    throw new BoomyException($"Required .mogg file not found: {moggSourcePath}. Please build it.");
                }
            }

            // Handle cover image conversion and copying
            string keepPngDestPath = Path.Combine(genDir, inputFolderName + "_keep.png_xbox");

            // First check if there's a cover image path in metadata
            if (!string.IsNullOrEmpty(Request.SongMeta.CoverImagePath))
            {
                string coverImagePath = Request.SongMeta.CoverImagePath;

                // Make absolute path if it's relative
                if (!Path.IsPathRooted(coverImagePath))
                {
                    coverImagePath = Path.Combine(Request.Path, coverImagePath);
                }

                // Check if the cover image exists and convert it
                if (File.Exists(coverImagePath) && Path.GetExtension(coverImagePath).ToLower() == ".png")
                {
                    try
                    {
                        await BoomyConverters.ArtCover.PngToXboxHmxConverter.ConvertAsync(coverImagePath, keepPngDestPath);
                    }
                    catch (Exception ex)
                    {
                        throw new BoomyException($"Failed to convert cover image: {ex.Message}");
                    }
                }
                else if (File.Exists(coverImagePath))
                {
                    throw new BoomyException($"Cover image must be a PNG file: {coverImagePath}");
                }
                else
                {
                    throw new BoomyException($"Cover image not found: {coverImagePath}");
                }
            }
            else
            {
                // Fallback to old behavior - look for _keep.png_xbox file
                string keepPngSourcePath = Path.Combine(Request.Path, inputFolderName + "_keep.png_xbox");
                if (File.Exists(keepPngSourcePath))
                {
                    File.Copy(keepPngSourcePath, keepPngDestPath, true);
                }
                else
                {
                    // Try to find and convert a PNG file with the old naming convention
                    string keepPngPath = Path.Combine(Request.Path, inputFolderName + "_keep.png");
                    if (File.Exists(keepPngPath))
                    {
                        try
                        {
                            await BoomyConverters.ArtCover.PngToXboxHmxConverter.ConvertAsync(keepPngPath, keepPngDestPath);
                        }
                        catch (Exception ex)
                        {
                            throw new BoomyException($"Failed to convert cover image: {ex.Message}");
                        }
                    }
                }
            }

            SongMetadataGenerator.GenerateSongsDta(Request.SongsDtaPath, Request.SongMeta, songsDir, inputFolderName, midiEvents);

            if (Request.Package)
            {
                BoomyConverters.PackageCreator.PackageCreator.CreatePackage(Request.OutPath, Path.Combine(Request.Path, inputFolderName), $"{Request.SongMeta.Artist} - {Request.SongMeta.Name}", "A custom DC3 DLC created with Boomy!");
            }

            return null;
        }
    }
}