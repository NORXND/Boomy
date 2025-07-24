namespace BoomyBuilder.Builder.Models.Drums
{
    using System.Collections.Generic;

    using System.Globalization;
    using Newtonsoft.Json;
    using Newtonsoft.Json.Converters;

    public partial class Drums
    {
        [JsonProperty("sound", Required = Required.Always)]
        public required string Sound { get; set; }

        [JsonProperty("events", Required = Required.Always)]
        public required List<int> Events { get; set; }
    }

    public partial class Drums
    {
        public static Drums? FromJson(string json)
        {
            return JsonConvert.DeserializeObject<Drums>(json, Converter.Settings);
        }
    }

    public static class Serialize
    {
        public static string ToJson(this Drums self) => JsonConvert.SerializeObject(self, Converter.Settings);
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
