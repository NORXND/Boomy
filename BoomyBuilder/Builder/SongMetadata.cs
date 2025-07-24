using System;
using System.Collections.Generic;
using System.IO;
using System.Text.RegularExpressions;
using BoomyBuilder.Builder.Models.SongMeta;
using BoomyBuilder.Builder.Extensions;
using BoomyBuilder.Builder.Drumer;

namespace BoomyBuilder.Builder.SongMetadata
{
    public static class SongMetadataGenerator
    {
        public static void GenerateSongsDta(string templatePath, SongMeta meta, string outputDir, string songName, List<MidiEvent> midiEvents)
        {
            if (!File.Exists(templatePath))
                throw new FileNotFoundException($"Template not found: {templatePath}");

            string template = File.ReadAllText(templatePath);

            // Prepare replacements
            var replacements = new Dictionary<string, string>
            {
                { "%SONGNAME%", songName},
                { "%SONGTITLE%", meta.Name },
                { "%SONGARTIST%", meta.Artist },
                { "%SONGID%", meta.Songid.ToString() },
                { "%SONGORIGIN%", meta.GameOrigin.GetEnumMemberValue() },
                { "%PANSVAL1%", $"{meta.Song.Pans.Val1:0.0}" },
                { "%PANSVAL2%", $"{meta.Song.Pans.Val2:0.0}" },
                { "%VOLSVAL1%", $"{meta.Song.Vols.Val1:0.0}" },
                { "%VOLSVAL2%", $"{meta.Song.Vols.Val2:0.0}" },
                { "%PREVIEWSTART%", meta.Preview.Start.ToString() },
                { "%PREVIEWEND%", meta.Preview.End.ToString() },
                { "%RANK%", meta.Rank.ToString() },
                { "%ALBUM%", meta.AlbumName },
                { "%GENDER%", meta.Gender.GetEnumMemberValue() },
                { "%BPM%", meta.Bpm.ToString() },
                { "%SONGLENGTH%", meta.SongLength.ToString() },
                { "%DEFAULTCHAR%", meta.DefaultCharacter.GetEnumMemberValue() },
                { "%DEFAULTARTCHAR%", meta.DefaultCharacterAlt.GetEnumMemberValue() },
                { "%BACKUPCHAR%", meta.BackupCharacter.GetEnumMemberValue() },
                { "%BACKUPCHARALT%", meta.BackupCharacterAlt.GetEnumMemberValue() },
                { "%VENUE%", meta.DefaultVenue.GetEnumMemberValue() },
                { "%BACKUPVENUE%", meta.BackupVenue.GetEnumMemberValue() },
                { "%INTENSITY%", meta.DjIntensityRank.ToString() },
                { "%YEAR%", meta.YearReleased.ToString() },
                { "%RATING%", "0" }, // Add rating if available in meta
            };

            // Replace all placeholders
            foreach (var kv in replacements)
            {
                template = template.Replace(kv.Key, kv.Value);
            }

            // Handle midi_events FOR loop
            string midiEventsStr = string.Empty;
            foreach (var evt in midiEvents)
            {
                midiEventsStr += $"      ({evt.Key.Item3} {evt.Sound})\n";
            }
            template = Regex.Replace(template, "%FOR I IN MIDIEVENTS%(.|\n)*?%ENDFOR%", midiEventsStr.TrimEnd(), RegexOptions.Multiline);

            // Write to output
            Directory.CreateDirectory(outputDir);
            string outPath = Path.Combine(outputDir, "songs.dta");
            File.WriteAllText(outPath, template);
        }
    }
}