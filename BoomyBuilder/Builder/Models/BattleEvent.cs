namespace BoomyBuilder.Builder.Models.BattleEvent
{
    using System.Collections.Generic;

    using System.Globalization;
    using Newtonsoft.Json;
    using Newtonsoft.Json.Converters;

    public partial class BattleEvent
    {
        [JsonProperty("type", Required = Required.Always)]
        public required BattleEventType Type { get; set; }

        [JsonProperty("measure", Required = Required.Always)]
        public required int Measure { get; set; }
    }

    public partial class BattleEvent
    {
        public static BattleEvent? FromJson(string json)
        {
            return JsonConvert.DeserializeObject<BattleEvent>(json, Converter.Settings);
        }
    }

    public static class Serialize
    {
        public static string ToJson(this BattleEvent self) => JsonConvert.SerializeObject(self, Converter.Settings);
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
