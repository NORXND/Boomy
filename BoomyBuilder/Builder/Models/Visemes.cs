namespace BoomyBuilder.Builder.Models.Visemes
{
    using System.Collections.Generic;

    using System.Globalization;
    using Newtonsoft.Json;
    using Newtonsoft.Json.Converters;

    public partial class VisemesEvent
    {
        [JsonProperty("viseme", Required = Required.Always)]
        public required VisemesType Viseme { get; set; }

        [JsonProperty("beat", Required = Required.Always)]
        public required int Beat { get; set; }

        [JsonProperty("value", Required = Required.Always)]
        public required float Value { get; set; }
    }

    public partial class VisemesEvents
    {
        [JsonProperty("easy", Required = Required.Always)]
        public required List<VisemesEvent> Easy { get; set; }

        [JsonProperty("medium", Required = Required.Always)]
        public required List<VisemesEvent> Medium { get; set; }

        [JsonProperty("expert", Required = Required.Always)]
        public required List<VisemesEvent> Expert { get; set; }
    }

    public partial class VisemesEvents
    {
        public static VisemesEvents? FromJson(string json)
        {
            return JsonConvert.DeserializeObject<VisemesEvents>(json, Converter.Settings);
        }
    }

    public static class Serialize
    {
        public static string ToJson(this VisemesEvents self) => JsonConvert.SerializeObject(self, Converter.Settings);
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
