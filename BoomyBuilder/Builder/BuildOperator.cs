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
            string path = Path.Combine(AppContext.BaseDirectory, "Assets", "template.milo_xbox");
            WorkingMilo = new MiloFile(path);

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

            AssetsImporter.ImportAsset(Request, this);
            Dictionary<Difficulty, Dictionary<int, Move>> choreography = ChoreoMaker.ChoreoMaker.ParseChoreography(this);
            Dictionary<Difficulty, Dictionary<int, CameraPosition>> camPositions = Camerator.Camerator.ParseCameraEvents(Request.Timeline);
            MoveGrapher.MoveGrapher.BuildMoveGraph(graph, choreography);
            Animator.Animator.BuildSongAnim(easyAnim, mediumAnim, expertAnim, choreography, camPositions);

            Directory.CreateDirectory(Request.OutPath);

            // Milo
            string genDir = Path.Combine(Request.OutPath, "gen");
            Directory.CreateDirectory(genDir);

            string miloOutputPath = Path.Combine(genDir, Path.GetFileName(Request.OutPath) + ".milo_xbox");
            WorkingMilo.Save(miloOutputPath, MiloFile.Type.CompressedZlibAlt);

            return null;
        }
    }
}