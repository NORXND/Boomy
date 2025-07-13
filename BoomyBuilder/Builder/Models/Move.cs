namespace BoomyBuilder.Builder.Models.Move
{
    using System.Collections.Generic;

    using System.Globalization;
    using Newtonsoft.Json;
    using Newtonsoft.Json.Converters;

    public partial class Move
    {
        [JsonProperty("clip", Required = Required.Always)]
        public required string Clip { get; set; }

        [JsonProperty("assets", Required = Required.Always)]
        public required Assets Assets { get; set; }

        [JsonProperty("data", Required = Required.Always)]
        public required MoveData Data { get; set; }
    }

    public partial class MoveData
    {
        [JsonProperty("difficulty", Required = Required.Always)]
        public Difficulty Difficulty { get; set; }
        [JsonProperty("genre_flags", Required = Required.Always)]
        public List<string> GenreFlags { get; set; }
        [JsonProperty("era_flags", Required = Required.Always)]
        public List<string> EraFlags { get; set; }
        [JsonProperty("display_name", Required = Required.Always)]
        public string DisplayName { get; set; }

        [JsonProperty("name", Required = Required.Always)]
        public string Name { get; set; }

        [JsonProperty("move_name", Required = Required.Always)]
        public string MoveName { get; set; }
        [JsonProperty("move_miloname", Required = Required.Always)]
        public string MoveMiloname { get; set; }

        [JsonProperty("linked_to", Required = Required.Always)]
        public string LinkedTo { get; set; }
        [JsonProperty("linked_from", Required = Required.Always)]
        public string LinkedFrom { get; set; }

        [JsonProperty("genre", Required = Required.Always)]
        public string Genre { get; set; }
        [JsonProperty("era", Required = Required.Always)]
        public string Era { get; set; }
        [JsonProperty("song_name", Required = Required.Always)]
        public string SongName { get; set; }

        [JsonProperty("avg_beats_per_sec", Required = Required.Always)]
        public float AvgBeatsPerSec { get; set; }

        [JsonProperty("flags", Required = Required.Always)]
        public uint Flags { get; set; }
    }

    public partial class Assets
    {
        [JsonProperty("clips", Required = Required.Always)]
        public required List<string> Clips { get; set; }

        [JsonProperty("move", Required = Required.Always)]
        public required List<string> Move { get; set; }

        [JsonProperty("move_data", Required = Required.Always)]
        public required List<string> MoveData { get; set; }
    }

    public partial class Move
    {
        public static Move? FromJson(string json)
        {
            return JsonConvert.DeserializeObject<Move>(json, Converter.Settings);
        }
    }

    public static class Serialize
    {
        public static string ToJson(this Move self)
        {
            return JsonConvert.SerializeObject(self, Converter.Settings);
        }
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
