namespace BoomyBuilder.Builder.Models.Timeline
{
    using System.Collections.Generic;
    using System.ComponentModel.DataAnnotations;
    using System.Globalization;
    using BoomyBuilder.Builder.Models.Move;
    using Newtonsoft.Json;
    using Newtonsoft.Json.Converters;

    public partial class Timeline
    {
        [JsonProperty("easy", Required = Required.Always)]
        public required DifficultyTimeline Easy { get; set; }
        [JsonProperty("medium", Required = Required.Always)]
        public required DifficultyTimeline Medium { get; set; }
        [JsonProperty("expert", Required = Required.Always)]
        public required DifficultyTimeline Expert { get; set; }
    }

    public partial class DifficultyTimeline
    {
        [JsonProperty("moves", Required = Required.Always)]
        public required List<MoveEvent> Moves { get; set; }

        [JsonProperty("cameras", Required = Required.Always)]
        public required List<CameraEvent> Cameras { get; set; }
    }

    public partial class CameraEvent
    {
        [JsonProperty("beat", Required = Required.Always)]
        public int Beat { get; set; }

        [JsonProperty("position", Required = Required.Always)]
        public CameraPosition Position { get; set; }
    }

    public partial class MoveEvent
    {
        [JsonProperty("measure", Required = Required.Always)]
        public int Measure { get; set; }

        [JsonProperty("clip", Required = Required.Always)]
        public string Clip { get; set; }

        [JsonProperty("move_origin", Required = Required.Always)]
        public string MoveOriginPath { get; set; }

        [JsonProperty("move_song", Required = Required.Always)]
        public string MoveSongPath { get; set; }

        [JsonProperty("move", Required = Required.Always)]
        public required string MovePath { get; set; }
    }

    public partial class Timeline
    {
        public static Timeline? FromJson(string json)
        {
            return JsonConvert.DeserializeObject<Timeline>(json, Converter.Settings);
        }
    }

    public static class Serialize
    {
        public static string ToJson(this Timeline self) => JsonConvert.SerializeObject(self, Converter.Settings);
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
