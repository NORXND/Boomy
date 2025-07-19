namespace BoomyBuilder.Builder.Models.Practice
{
    using System.Collections.Generic;
    using BoomyBuilder.Builder.Models.Timeline;
    using Newtonsoft.Json;

    public partial class Practice
    {
        [JsonProperty("easy", Required = Required.Always)]
        public required List<List<MoveEvent>> Easy { get; set; }
        [JsonProperty("medium", Required = Required.Always)]
        public required List<List<MoveEvent>> Medium { get; set; }
        [JsonProperty("expert", Required = Required.Always)]
        public required List<List<MoveEvent>> Expert { get; set; }
    }


}