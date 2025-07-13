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

        public static void ImportAsset(BuildRequest.BuildRequest req, BuildOperator buildOperator)
        {

            void ImportAsset(string assetPath, DirectoryMeta dir)
            {
                string name = Path.GetFileName(assetPath);
                string ext = Path.GetExtension(assetPath);

                if (dir.entries.Any(entry => entry.name == name))
                {
                    return;
                }

                byte[] fileBytes = File.ReadAllBytes(assetPath);
                string assetType = AssetTypes[ext];

                DirectoryMeta.Entry entry = DirectoryMeta.Entry.CreateDirtyAssetFromBytes(assetType, name, [.. fileBytes]);
                dir.entries.Add(entry);

                using EndianReader reader = new(new MemoryStream(fileBytes), Endian.BigEndian);
                switch (assetType)
                {
                    case "Tex":
                        entry.obj = new RndTex().Read(reader, false, dir, entry);
                        break;
                    case "HamMove":
                        entry.obj = new HamMove().Read(reader, false, dir, entry);
                        break;
                    case "DancerSequence":
                        entry.obj = new DancerSequence().Read(reader, false, dir, entry);
                        break;
                    case "CharClip (Ham)":
                        entry.obj = new CharClip().Read(reader, false, dir, entry);
                        break;
                }
            }


            void ImportMoveAssets(Move move)
            {
                // Clips
                // WARNING: We assume there are clips and clips ONLY in clips directory. Putting no clips will explode your PC !!!
                move.Assets.Clips.ForEach(asset =>
                {
                    DirectoryMeta dir = buildOperator.ClipsDir ?? throw new Exception("No clips directory set");
                    ImportAsset(asset, dir);
                });

                move.Assets.Move.ForEach(asset =>
                {
                    DirectoryMeta dir = buildOperator.MovesDir ?? throw new Exception("No moves directory set");
                    ImportAsset(asset, dir);
                });

                move.Assets.MoveData.ForEach(asset =>
                {
                    DirectoryMeta dir = buildOperator.MoveDataDir ?? throw new Exception("No move_data directory set");
                    ImportAsset(asset, dir);
                });
            }


            req.Timeline.Easy.Moves.ForEach(m => ImportMoveAssets(m.Move));
            req.Timeline.Medium.Moves.ForEach(m => ImportMoveAssets(m.Move));
            req.Timeline.Expert.Moves.ForEach(m => ImportMoveAssets(m.Move));
        }
    }
}