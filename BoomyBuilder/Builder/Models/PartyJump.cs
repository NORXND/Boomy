namespace BoomyBuilder.Builder.Models.PartyJump
{
    using System.Collections.Generic;

    using System.Globalization;
    using Newtonsoft.Json;
    using Newtonsoft.Json.Converters;

    public partial class PartyJump
    {
        [JsonProperty("type", Required = Required.Always)]
        public required PartyJumpType Type { get; set; }

        [JsonProperty("measure", Required = Required.Always)]
        public required int Measure { get; set; }
    }

    public partial class PartyJump
    {
        public static PartyJump? FromJson(string json)
        {
            return JsonConvert.DeserializeObject<PartyJump>(json, Converter.Settings);
        }
    }

    public static class Serialize
    {
        public static string ToJson(this PartyJump self) => JsonConvert.SerializeObject(self, Converter.Settings);
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
