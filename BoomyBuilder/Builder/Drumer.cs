using BoomyBuilder.Builder.Models.Drums;
using Melanchall.DryWetMidi.MusicTheory;
using MiloLib.Assets;
using MiloLib.Utils;

namespace BoomyBuilder.Builder.Drumer
{
    public class MidiEvent
    {
        public (NoteName, int, string) Key { get; set; }
        public string Sound { get; set; }
        public List<int> Keys { get; set; }

        public MidiEvent((NoteName, int, string) note, string sound)
        {
            Key = note;
            Sound = sound;
            Keys = [];
        }
    }

    public class Drumer
    {
        List<(NoteName, int, string)> availableNoteNames = new List<(NoteName, int, string)>
        {
            (NoteName.C, 1, "c0"),
            (NoteName.CSharp, 1, "c#0"),
            (NoteName.D, 1, "d0"),
            (NoteName.DSharp, 1, "d#0"),
            (NoteName.E, 1, "e0"),
            (NoteName.F, 1, "f0"),
            (NoteName.FSharp, 1, "f#0"),
            (NoteName.G, 1, "g0"),
            (NoteName.GSharp, 1, "g#0"),
            (NoteName.A, 1, "a0"),
            (NoteName.ASharp, 1, "a#0"),
            (NoteName.B, 1, "b0"),

            (NoteName.C, 2, "c1"),
            (NoteName.CSharp, 2, "c#1"),
            (NoteName.D, 2, "d1"),
            (NoteName.DSharp, 2, "d#1"),
            (NoteName.E, 2, "e1"),
            (NoteName.F, 2, "f1"),
            (NoteName.FSharp, 2, "f#1"),
            (NoteName.G, 2, "g1"),
            (NoteName.GSharp, 2, "g#1"),
            (NoteName.A, 2, "a1"),
            (NoteName.ASharp, 2, "a#1"),
            (NoteName.B, 2, "b1"),

            (NoteName.C, 3, "c2"),
            (NoteName.CSharp, 3, "c#2"),
            (NoteName.D, 3, "d2"),
            (NoteName.DSharp, 3, "d#2"),
            (NoteName.E, 3, "e2"),
            (NoteName.F, 3, "f2"),
            (NoteName.FSharp, 3, "f#2"),
            (NoteName.G, 3, "g2"),
            (NoteName.GSharp, 3, "g#2"),
            (NoteName.A, 3, "a2"),
            (NoteName.ASharp, 3, "a#2"),
            (NoteName.B, 3, "b2"),

            (NoteName.C, 4, "c3"),
            (NoteName.CSharp, 4, "c#3"),
            (NoteName.D, 4, "d3"),
            (NoteName.DSharp, 4, "d#3"),
        };

        public static Dictionary<string, string> AssetTypes = new Dictionary<string, string>
        {
            {".snd", "Sound"},
            {".wav", "SynthSample"},
        };

        public static readonly Dictionary<string, (string note, string midiLabel)> SoundToMidiMap = new()
        {
            { "agogo_1", ("D#0", "midi_agogo") },
            { "agogo_2", ("D#0", "midi_agogo") },
            { "claps_1", ("D#0", "midi_claps") },
            { "claps_2", ("F0", "midi_claps") },
            { "claps_3", ("D#0", "midi_claps") },
            { "conga_1", ("E0", "midi_conga") },
            { "conga_2", ("D#0", "midi_conga") },
            { "crash_1", ("F0", "midi_crash") },
            { "crash_2", ("E0", "midi_crash") },
            { "crash_splash_1", ("F0", "midi_crash") },
            { "hihat_closed_1", ("D0", "midi_hat") },
            { "hihat_closed_2", ("E0", "midi_hat") },
            { "hihat_closed_e_1", ("D0", "midi_hat") },
            { "hihat_open_1", ("E0", "midi_open_hat") },
            { "hihat_open_2", ("D#0", "midi_open_hat") },
            { "kick_2", ("C0", "midi_kick") },
            { "kick_3", ("C0", "midi_kick") },
            { "kick_4", ("C0", "midi_kick") },
            { "kick_5", ("C0", "midi_kick") },
            { "ride_bell_1", ("E0", "midi_ride") },
            { "shaker_1", ("D0", "midi_shaker") },
            { "shaker_2", ("D#0", "midi_shaker") },
            { "snare_1", ("C#0", "midi_snare") },
            { "snare_2", ("C#0", "midi_snare") },
            { "snare_3", ("A0", "midi_snare") }, // If you want both, use a list/array
            { "snare_4", ("C#0", "midi_snare") },
            { "snare_e_2", ("C#0", "midi_snare") },
            { "snare_rim_1", ("D#0", "midi_snare_rim") },
            { "snare_rim_2", ("C#0", "midi_snare_rim") },
            { "snare_rim_e_1", ("C#0", "midi_snare_rim") },
            { "tabla_1", ("C0", "midi_tabla") },
            { "tabla_2", ("F0", "midi_tabla") },
            { "tamb_1", ("E0", "midi_tamb") },
            { "tom_1", ("D#0", "midi_tom") },
            { "tom_2", ("D#0", "midi_tom") },
            { "tom_3", ("E0", "midi_tom") },
            { "tom_4", ("F0", "midi_tom") },
        };

        public static List<MidiEvent> GenerateMidiEvents(BuildOperator op)
        {
            List<Drums> drums = op.Request.Drums;

            var midiEvents = new List<MidiEvent>();
            List<string> importedFiles = [];

            DirectoryMeta MidiDir = op.WorkingMilo!.dirMeta.entries.First(static d => d.name == "midi_bank").dir ?? throw new Exception("midi_bank dir not found");

            foreach (var drum in drums)
            {
                string name = drum.Sound;

                // Find all notes for this sample name
                if (SoundToMidiMap.TryGetValue(name, out var mapping))
                {
                    // If you want to support multiple notes per sound, change mapping to a list/array
                    // For now, mapping is (string note, string midiLabel)
                    var note = mapping.note.ToLowerInvariant();
                    var midiLabel = mapping.midiLabel;

                    midiEvents.Add(new MidiEvent(
                        // Find the availableNoteNames tuple matching this note string
                        FindNoteTuple(note),
                        name
                    )
                    {
                        Keys = drum.Events.ToList()
                    });
                }
                else
                {
                    // Fallback: assign first available note
                    midiEvents.Add(new MidiEvent(
                        new Drumer().availableNoteNames[0],
                        name
                    )
                    {
                        Keys = drum.Events.ToList()
                    });
                }

                string path = Path.Combine(op.Request.MovesPath, "midi_bank", name);

                if (Path.Exists(path))
                {
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
                        MidiDir.entries.Add(entry);

                        using MiloLib.Utils.EndianReader reader = new(new MemoryStream(fileBytes), Endian.BigEndian);
                        switch (assetType)
                        {
                            case "Sound":
                                entry.obj = new Sound().Read(reader, false, MidiDir, entry);
                                break;
                            case "SynthSample":
                                entry.obj = new SynthSample().Read(reader, false, MidiDir, entry);
                                break;
                        }
                    }
                }
            }

            return midiEvents;

            // Helper to find the tuple in availableNoteNames by note string (e.g. "c#0")
            static (NoteName, int, string) FindNoteTuple(string noteStr)
            {
                var availableNotes = new Drumer().availableNoteNames;
                var found = availableNotes.FirstOrDefault(n => n.Item3.Equals(noteStr, StringComparison.OrdinalIgnoreCase));
                if (found == default)
                    throw new Exception($"Note {noteStr} not found in availableNoteNames.");
                return found;
            }
        }


    }
}