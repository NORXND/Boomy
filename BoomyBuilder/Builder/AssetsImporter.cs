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

            void ImportAsset(string assetPath, DirectoryMeta dir, bool cutSeq = false)
            {

                string name = Path.GetFileName(assetPath);
                string ext = Path.GetExtension(assetPath);
                string assetType = AssetTypes[ext];

                // Remove _songname for HamMove and Tex
                if (cutSeq && (assetType == "HamMove" || assetType == "Tex"))
                {
                    // Remove extension for manipulation
                    string nameNoExt = Path.GetFileNameWithoutExtension(name);
                    // Find last underscore (before songname)
                    int lastUnderscore = nameNoExt.LastIndexOf('_');
                    if (lastUnderscore > 0)
                    {
                        // For Tex, preserve _sm if present
                        if (assetType == "Tex" && nameNoExt.EndsWith("_sm"))
                        {
                            // Remove _songname before _sm
                            int smIndex = nameNoExt.LastIndexOf("_sm");
                            string beforeSm = nameNoExt.Substring(0, smIndex);
                            int lastUSBeforeSm = beforeSm.LastIndexOf('_');
                            if (lastUSBeforeSm > 0)
                            {
                                nameNoExt = beforeSm.Substring(0, lastUSBeforeSm) + nameNoExt.Substring(smIndex);
                            }
                        }
                        else
                        {
                            // Remove _songname
                            nameNoExt = nameNoExt.Substring(0, lastUnderscore);
                        }
                    }
                    name = nameNoExt + ext;
                }


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

                        if (cutSeq)
                        {
                            // If cutSeq is true, set mDancerSeq to a default value
                            var hamMoveObj = (HamMove)entry.obj;
                            hamMoveObj.mDancerSeq = new Symbol(0, "");

                            // Also update tex value to strip _songname (preserving _sm if present)
                            string texName = hamMoveObj.tex.value;
                            if (!string.IsNullOrEmpty(texName))
                            {
                                string texNoExt = Path.GetFileNameWithoutExtension(texName);
                                string texExt = Path.GetExtension(texName);
                                int lastUnderscore = texNoExt.LastIndexOf('_');
                                if (lastUnderscore > 0)
                                {
                                    if (texNoExt.EndsWith("_sm"))
                                    {
                                        int smIndex = texNoExt.LastIndexOf("_sm");
                                        string beforeSm = texNoExt.Substring(0, smIndex);
                                        int lastUSBeforeSm = beforeSm.LastIndexOf('_');
                                        if (lastUSBeforeSm > 0)
                                        {
                                            texNoExt = beforeSm.Substring(0, lastUSBeforeSm) + texNoExt.Substring(smIndex);
                                        }
                                    }
                                    else
                                    {
                                        texNoExt = texNoExt.Substring(0, lastUnderscore);
                                    }
                                }
                                hamMoveObj.tex = new Symbol(0, texNoExt + texExt);
                            }

                            foreach (var key in hamMoveObj.propKeys)
                            {
                                key.target = entry.name;
                            }
                        }

                        hamMoves.Add((HamMove)entry.obj);
                        break;
                    case "DancerSequence":
                        entry.obj = new DancerSequence().Read(reader, false, dir, entry);
                        break;
                    case "CharClip":
                        entry.obj = new CharClip().Read(reader, false, dir, entry);
                        break;
                }
                entry.dirty = false;
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

                // Move - get all .tex, .move
                var moveFiles = allFiles.Where(file =>
                {
                    string ext = Path.GetExtension(file).ToLowerInvariant();
                    return ext == ".tex" || ext == ".move";
                }).ToList();
                moveFiles.ForEach(asset =>
                {
                    DirectoryMeta dir = buildOperator.MovesDir ?? throw new Exception("No moves directory set");
                    ImportAsset(asset, dir, cutSeq: true);
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