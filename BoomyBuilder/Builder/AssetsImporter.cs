using BoomyBuilder.Builder.Models.Move;
using MiloLib;
using MiloLib.Assets;
using MiloLib.Assets.Ham;
using MiloLib.Assets.Rnd;
using MiloLib.Utils;

namespace BoomyBuilder.Builder
{
    class AssetsImporter
    {

        public static Dictionary<string, string> AssetTypes = new Dictionary<string, string>
        {
            {".tex", "Tex"},
            {".move", "HamMove"},
            {".seq", "DancerSequence"},
            {"", "CharClip"},
        };

        public static void ImportAsset(BuildRequest.BuildRequest req, BuildOperator buildOperator, List<HamMove> hamMoves)
        {
            // Registry to track imported files by destination directory
            Dictionary<DirectoryMeta, HashSet<string>> importedFiles = new Dictionary<DirectoryMeta, HashSet<string>>();

            void ImportAsset(string assetPath, DirectoryMeta dir)
            {
                string name = Path.GetFileName(assetPath);
                string ext = Path.GetExtension(assetPath);

                // Initialize registry for this directory if not exists
                if (!importedFiles.ContainsKey(dir))
                {
                    importedFiles[dir] = new HashSet<string>();
                }

                // Check if already imported in this session
                if (importedFiles[dir].Contains(name))
                {
                    return;
                }

                // Check if already exists in directory
                if (dir.entries.Any(entry => entry.name == name))
                {
                    importedFiles[dir].Add(name); // Mark as imported even if it already existed
                    return;
                }

                byte[] fileBytes = File.ReadAllBytes(assetPath);
                string assetType = AssetTypes[ext];

                DirectoryMeta.Entry entry = DirectoryMeta.Entry.CreateDirtyAssetFromBytes(assetType, name, [.. fileBytes]);
                dir.entries.Add(entry);

                // Mark as imported
                importedFiles[dir].Add(name);

                using EndianReader reader = new(new MemoryStream(fileBytes), Endian.BigEndian);
                switch (assetType)
                {
                    case "Tex":
                        entry.obj = new RndTex().Read(reader, false, dir, entry);
                        break;
                    case "HamMove":
                        entry.obj = new HamMove().Read(reader, false, dir, entry);
                        hamMoves.Add((HamMove)entry.obj);
                        break;
                    case "DancerSequence":
                        entry.obj = new DancerSequence().Read(reader, false, dir, entry);
                        break;
                    case "CharClip":
                        entry.obj = new CharClip().Read(reader, false, dir, entry);
                        break;
                }
            }


            void ImportMoveAssets(string movePath, string clip)
            {
                if (!Directory.Exists(movePath))
                {
                    throw new Exception($"Move path does not exist: {movePath}");
                }

                string[] allFiles = Directory.GetFiles(movePath);

                // Clips - get all files with no extension
                var clipFiles = allFiles.Where(file => Path.GetFileNameWithoutExtension(file) == clip).ToList();
                clipFiles.ForEach(asset =>
                {
                    DirectoryMeta dir = buildOperator.ClipsDir ?? throw new Exception("No clips directory set");
                    ImportAsset(asset, dir);
                });

                // Move - get all .tex, .move, and .seq files
                var moveFiles = allFiles.Where(file =>
                {
                    string ext = Path.GetExtension(file).ToLowerInvariant();
                    return ext == ".tex" || ext == ".move" || ext == ".seq";
                }).ToList();
                moveFiles.ForEach(asset =>
                {
                    DirectoryMeta dir = buildOperator.MovesDir ?? throw new Exception("No moves directory set");
                    ImportAsset(asset, dir);
                });

                // MoveData - get all .tex, .move, .seq, and no extension files
                var moveDataFiles = allFiles.Where(file =>
                {
                    string ext = Path.GetExtension(file).ToLowerInvariant();
                    string name = Path.GetFileName(file);
                    return ext == ".tex" || ext == ".move" || ext == ".seq" || name == clip;
                }).ToList();
                moveDataFiles.ForEach(asset =>
                {
                    DirectoryMeta dir = buildOperator.MoveDataDir ?? throw new Exception("No move_data directory set");
                    ImportAsset(asset, dir);
                });
            }


            req.Timeline.Easy.Moves.ForEach(m => ImportMoveAssets(Path.Combine(buildOperator.Request.MovesPath, m.MoveOriginPath, m.MoveSongPath, m.MovePath), m.Clip));
            req.Timeline.Medium.Moves.ForEach(m => ImportMoveAssets(Path.Combine(buildOperator.Request.MovesPath, m.MoveOriginPath, m.MoveSongPath, m.MovePath), m.Clip));
            req.Timeline.Expert.Moves.ForEach(m => ImportMoveAssets(Path.Combine(buildOperator.Request.MovesPath, m.MoveOriginPath, m.MoveSongPath, m.MovePath), m.Clip));
        }
    }
}