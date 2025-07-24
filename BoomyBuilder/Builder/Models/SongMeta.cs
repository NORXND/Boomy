namespace BoomyBuilder.Builder.Models.SongMeta
{
    using System.Collections.Generic;

    using System.Globalization;
    using Newtonsoft.Json;
    using Newtonsoft.Json.Converters;

    public partial class SongMeta
    {
        [JsonProperty("name", Required = Required.Always)]
        public required string Name { get; set; }

        [JsonProperty("artist", Required = Required.Always)]
        public required string Artist { get; set; }

        [JsonProperty("songid", Required = Required.Always)]
        public long Songid { get; set; }

        [JsonProperty("game_origin", Required = Required.Always)]
        public required GameOrigin GameOrigin { get; set; }

        [JsonProperty("song", Required = Required.Always)]
        public required SongTracks Song { get; set; }

        [JsonProperty("preview", Required = Required.Always)]
        public required Preview Preview { get; set; }

        [JsonProperty("rank", Required = Required.Always)]
        public long Rank { get; set; }

        [JsonProperty("album_name", Required = Required.Always)]
        public required string AlbumName { get; set; }

        [JsonProperty("gender", Required = Required.Always)]
        public required Gender Gender { get; set; }

        [JsonProperty("default_character", Required = Required.Always)]
        public required Character DefaultCharacter { get; set; }

        [JsonProperty("default_character_alt", Required = Required.Always)]
        public required Character DefaultCharacterAlt { get; set; }

        [JsonProperty("backup_character", Required = Required.Always)]
        public required Character BackupCharacter { get; set; }

        [JsonProperty("backup_character_alt", Required = Required.Always)]
        public required Character BackupCharacterAlt { get; set; }

        [JsonProperty("default_venue", Required = Required.Always)]
        public required Venue DefaultVenue { get; set; }

        [JsonProperty("backup_venue", Required = Required.Always)]
        public required Venue BackupVenue { get; set; }

        [JsonProperty("dj_intensity_rank", Required = Required.Always)]
        public short DjIntensityRank { get; set; }

        [JsonProperty("year_released", Required = Required.Always)]
        public long YearReleased { get; set; }

        [JsonProperty("bpm", Required = Required.Always)]
        public int Bpm { get; set; }

        [JsonProperty("song_length", Required = Required.Always)]
        public int SongLength { get; set; }

        [JsonProperty("cover_image_path")]
        public string? CoverImagePath { get; set; }
    }

    public partial class Preview
    {
        [JsonProperty("start", Required = Required.Always)]
        public long Start { get; set; }

        [JsonProperty("end", Required = Required.Always)]
        public long End { get; set; }
    }

    public partial class SongTracks
    {
        [JsonProperty("tracks", Required = Required.Always)]
        public required List<Track> Tracks { get; set; }

        [JsonProperty("pans", Required = Required.Always)]
        public required PansVols Pans { get; set; }

        [JsonProperty("vols", Required = Required.Always)]
        public required PansVols Vols { get; set; }
    }

    public partial class PansVols
    {
        [JsonProperty("val1", Required = Required.Always)]
        public double Val1 { get; set; }

        [JsonProperty("val2", Required = Required.Always)]
        public double Val2 { get; set; }
    }

    public partial class Track
    {
        [JsonProperty("name", Required = Required.Always)]
        public required string Name { get; set; }

        [JsonProperty("start", Required = Required.Always)]
        public long Start { get; set; }

        [JsonProperty("end", Required = Required.Always)]
        public long End { get; set; }
    }

    public partial class SongMeta
    {
        public static SongMeta? FromJson(string json)
        {
            return JsonConvert.DeserializeObject<SongMeta>(json, Converter.Settings);
        }
    }

    public static class Serialize
    {
        public static string ToJson(this SongMeta self) => JsonConvert.SerializeObject(self, Converter.Settings);
    }

    internal static class Converter
    {
        public static readonly JsonSerializerSettings Settings = new JsonSerializerSettings
        {
            MissingMemberHandling = MissingMemberHandling.Error,
            MetadataPropertyHandling = MetadataPropertyHandling.Ignore,
            DateParseHandling = DateParseHandling.None,
            Converters =
            {
                new IsoDateTimeConverter { DateTimeStyles = DateTimeStyles.AssumeUniversal }
            },
        };
    }
}
