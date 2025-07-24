namespace BoomyBuilder.Builder.Models.BAMPhrases
{
    using System.Collections.Generic;

    using System.Globalization;
    using Newtonsoft.Json;
    using Newtonsoft.Json.Converters;

    public partial class BAMPhrases
    {
        [JsonProperty("count", Required = Required.Always)]
        public required int Count { get; set; }

        [JsonProperty("bars", Required = Required.Always)]
        public required int Bars { get; set; }

    }

    public partial class BAMPhrases
    {
        public static BAMPhrases? FromJson(string json)
        {
            return JsonConvert.DeserializeObject<BAMPhrases>(json, Converter.Settings);
        }
    }

    public static class Serialize
    {
        public static string ToJson(this BAMPhrases self) => JsonConvert.SerializeObject(self, Converter.Settings);
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
