using MiloLib;
using MiloLib.Assets;
using MiloLib.Assets.Ham;
using MiloLib.Assets.Rnd;
using MiloLib.Utils;

namespace BoomyBuilder.Builder
{
    public class Barker
    {
        static List<string> languages = ["cht", "deu", "dut", "eng", "esl", "fre", "ita", "jpn", "kor", "mex", "nor", "pol", "ptb", "rus", "swe"];

        public static Dictionary<string, string> AssetTypes = new Dictionary<string, string>
        {
            {".snd", "Sound"},
            {".wav", "SynthSample"},
        };

        public static void CreateBarks(List<HamMove> moves, BuildOperator buildOperator, string locPath)
        {
            foreach (string lang in languages)
            {
                string barkDir = Path.Combine(locPath, lang);
                Directory.CreateDirectory(barkDir);

                string barkGenDir = Path.Combine(barkDir, "gen");
                Directory.CreateDirectory(barkGenDir);

                MiloFile barksMilo = new(buildOperator.Request.BarksTemplatePath);
                List<string> importedFiles = [];

                foreach (HamMove move in moves)
                {
                    foreach (RndPropAnim.PropKey propKey in move.propKeys)
                    {
                        foreach (RndPropAnim.PropKey.AnimEventSymbol barkName in propKey.keys)
                        {
                            string name = barkName.Text.value;
                            string path = Path.Combine(buildOperator.Request.MovesPath, "barks", name, lang);

                            if (Path.Exists(path))
                            {
                                //  Import Bark
                                string[] allFiles = Directory.GetFiles(path);

                                foreach (string assetPath in allFiles)
                                {
                                    string fname = Path.GetFileName(assetPath);
                                    string fext = Path.GetExtension(assetPath);

                                    if (importedFiles.Contains(assetPath))
                                    {
                                        continue;
                                    }

                                    importedFiles.Add(assetPath);

                                    byte[] fileBytes = File.ReadAllBytes(assetPath);
                                    string assetType = AssetTypes[fext];

                                    DirectoryMeta.Entry entry = DirectoryMeta.Entry.CreateDirtyAssetFromBytes(assetType, name + fext, [.. fileBytes]);
                                    barksMilo.dirMeta.entries.Add(entry);

                                    using MiloLib.Utils.EndianReader reader = new(new MemoryStream(fileBytes), Endian.BigEndian);
                                    switch (assetType)
                                    {
                                        case "Sound":
                                            entry.obj = new Sound().Read(reader, false, barksMilo.dirMeta, entry);
                                            break;
                                        case "SynthSample":
                                            entry.obj = new SynthSample().Read(reader, false, barksMilo.dirMeta, entry);
                                            break;
                                    }
                                }
                            }
                        }
                    }
                }

                barksMilo.Save(Path.Combine(barkGenDir, "barks.milo_xbox"), buildOperator.Request.Compress ? MiloFile.Type.CompressedZlibAlt : MiloFile.Type.Uncompressed);
            }
        }
    }
}