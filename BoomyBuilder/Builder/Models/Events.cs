namespace BoomyBuilder.Builder.Models.SongEvent
{
    using System.Collections.Generic;

    using System.Globalization;
    using Newtonsoft.Json;
    using Newtonsoft.Json.Converters;

    public partial class SongEvent
    {
        [JsonProperty("type", Required = Required.Always)]
        public required SongEventType Type { get; set; }

        [JsonProperty("beat", Required = Required.Always)]
        public required int Beat { get; set; }
    }

    public partial class SongEvent
    {
        public static SongEvent? FromJson(string json)
        {
            return JsonConvert.DeserializeObject<SongEvent>(json, Converter.Settings);
        }
    }

    public static class Serialize
    {
        public static string ToJson(this SongEvent self) => JsonConvert.SerializeObject(self, Converter.Settings);
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
