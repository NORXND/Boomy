using BoomyBuilder.Builder.Models;
using BoomyBuilder.Builder.Models.Move;
using MiloLib;
using MiloLib.Assets;
using MiloLib.Assets.Ham;
using MiloLib.Assets.Rnd;

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

        public string? Build()
        {
            WorkingMilo = new MiloFile(Request.MiloTemplatePath);


            // Get input folder name for file naming
            string inputFolderName = Path.GetFileName(Request.Path);

            // Create output directory structure
            Directory.CreateDirectory(Request.OutPath);

            // Create song subfolder
            string songDir = Path.Combine(Request.OutPath, inputFolderName);
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

            List<HamMove> hamMoves = [];
            AssetsImporter.ImportAsset(Request, this, hamMoves);
            Barker.CreateBarks(hamMoves, this, locDir);
            Dictionary<Difficulty, Dictionary<int, Move>> choreography = ChoreoMaker.ChoreoMaker.ParseChoreography(this);
            Dictionary<Difficulty, Dictionary<int, CameraPosition>> camPositions = Camerator.Camerator.ParseCameraEvents(Request.Timeline);
            MoveGrapher.MoveGrapher.BuildMoveGraph(graph, choreography);
            Animator.Animator.BuildSongAnim(easyAnim, mediumAnim, expertAnim, choreography, camPositions);


            // Save milo file
            string miloOutputPath = Path.Combine(genDir, inputFolderName + ".milo_xbox");
            WorkingMilo.Save(miloOutputPath, MiloFile.Type.Uncompressed);

            // Copy .mogg file (required)
            string moggSourcePath = Path.Combine(Request.Path, inputFolderName + ".mogg");
            string moggDestPath = Path.Combine(songDir, inputFolderName + ".mogg");
            if (File.Exists(moggSourcePath))
            {
                File.Copy(moggSourcePath, moggDestPath, true);
            }
            else
            {
                throw new BoomyException($"Required .mogg file not found: {moggSourcePath}. Please build it.");
            }

            // Copy .mid file (required)
            string midSourcePath = Path.Combine(Request.Path, inputFolderName + ".mid");
            string midDestPath = Path.Combine(songDir, inputFolderName + ".mid");
            if (File.Exists(midSourcePath))
            {
                File.Copy(midSourcePath, midDestPath, true);
            }
            else
            {
                throw new BoomyException($"Required .mid file not found: {midSourcePath}");
            }

            // Copy _keep.png_xbox file (optional)
            string keepPngSourcePath = Path.Combine(Request.Path, inputFolderName + "_keep.png_xbox");
            string keepPngDestPath = Path.Combine(genDir, inputFolderName + "_keep.png_xbox");
            if (File.Exists(keepPngSourcePath))
            {
                File.Copy(keepPngSourcePath, keepPngDestPath, true);
            }

            // Handle songs.dta file
            string songsDtaSourcePath = Path.Combine(Request.Path, "songs.dta");
            string songsDtaPath = Path.Combine(Request.OutPath, "songs.dta");

            if (File.Exists(songsDtaSourcePath))
            {
                // Copy existing songs.dta from source
                File.Copy(songsDtaSourcePath, songsDtaPath, true);
            }
            else if (!File.Exists(songsDtaPath))
            {
                // Create empty songs.dta if it doesn't exist in either location
                File.WriteAllText(songsDtaPath, "");
            }

            return null;
        }
    }
}