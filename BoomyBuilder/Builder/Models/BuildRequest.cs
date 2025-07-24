namespace BoomyBuilder.Builder.BuildRequest
{
    using System.Globalization;
    using BoomyBuilder.Builder.Models.BAMPhrases;
    using BoomyBuilder.Builder.Models.BattleEvent;
    using BoomyBuilder.Builder.Models.Drums;
    using BoomyBuilder.Builder.Models.PartyJump;
    using BoomyBuilder.Builder.Models.Practice;
    using BoomyBuilder.Builder.Models.SongEvent;
    using BoomyBuilder.Builder.Models.SongMeta;
    using BoomyBuilder.Builder.Models.Timeline;
    using BoomyBuilder.Builder.Utils;
    using Newtonsoft.Json;
    using Newtonsoft.Json.Converters;

    public partial class BuildRequest
    {
        [JsonProperty("path", Required = Required.Always)]
        public required string Path { get; set; }

        [JsonProperty("moves_path", Required = Required.Always)]
        public required string MovesPath { get; set; }

        [JsonProperty("song_meta", Required = Required.Always)]
        public required SongMeta SongMeta { get; set; }

        [JsonProperty("milo_template_path", Required = Required.Always)]
        public required string MiloTemplatePath { get; set; }

        [JsonProperty("barks_template_path", Required = Required.Always)]
        public required string BarksTemplatePath { get; set; }

        [JsonProperty("songs_dta_path", Required = Required.Always)]
        public required string SongsDtaPath { get; set; }

        [JsonProperty("out_path", Required = Required.Always)]
        public required string OutPath { get; set; }

        [JsonProperty("timeline", Required = Required.Always)]
        public required Timeline Timeline { get; set; }

        [JsonProperty("tempo_change", Required = Required.Always)]
        public required List<TempoChange> TempoChange { get; set; }

        [JsonProperty("practice", Required = Required.Always)]
        public required Practice Practice { get; set; }

        [JsonProperty("supereasy", Required = Required.Always)]
        public required List<MoveEvent> Supereasy { get; set; }

        [JsonProperty("drums", Required = Required.Always)]
        public required List<Drums> Drums { get; set; }

        [JsonProperty("events", Required = Required.Always)]
        public required List<SongEvent> Events { get; set; }

        [JsonProperty("party_jumps", Required = Required.Always)]
        public required List<PartyJump> PartyJumps { get; set; }

        [JsonProperty("battle_steps", Required = Required.Always)]
        public required List<BattleEvent> BattleSteps { get; set; }


        [JsonProperty("party_battle_steps", Required = Required.Always)]
        public required List<BattleEvent> PartyBattleSteps { get; set; }

        [JsonProperty("bam_phrases", Required = Required.Always)]
        public required List<BAMPhrase> BamPhrases { get; set; }

        [JsonProperty("total_measures", Required = Required.Always)]
        public required int TotalMeasures { get; set; }

        [JsonProperty("compress", Required = Required.Always)]
        public required bool Compress { get; set; }

        [JsonProperty("package", Required = Required.Always)]
        public required bool Package { get; set; }
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
