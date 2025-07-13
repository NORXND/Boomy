namespace BoomyBuilder.Builder.BuildRequest
{
    using System.Globalization;
    using BoomyBuilder.Builder.Models.SongMeta;
    using BoomyBuilder.Builder.Models.Timeline;
    using Newtonsoft.Json;
    using Newtonsoft.Json.Converters;

    public partial class BuildRequest
    {
        [JsonProperty("path", Required = Required.Always)]
        public required string Path { get; set; }

        [JsonProperty("out_path", Required = Required.Always)]
        public required string OutPath { get; set; }

        [JsonProperty("song_meta", Required = Required.Always)]
        public required SongMeta SongMeta { get; set; }

        [JsonProperty("timeline", Required = Required.Always)]
        public required Timeline Timeline { get; set; }
    }

    public partial class BuildRequest
    {
        public static BuildRequest? FromJson(string json)
        {
            return JsonConvert.DeserializeObject<BuildRequest>(json, Converter.Settings);
        }
    }

    public static class Serialize
    {
        public static string ToJson(this BuildRequest self)
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
