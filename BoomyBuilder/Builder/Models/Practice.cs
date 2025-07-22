namespace BoomyBuilder.Builder.Models.Practice
{
    using System.Collections.Generic;
    using BoomyBuilder.Builder.Models.Timeline;
    using Newtonsoft.Json;

    public partial class Practice
    {
        [JsonProperty("easy", Required = Required.Always)]
        public required List<List<int>> Easy { get; set; }
        [JsonProperty("medium", Required = Required.Always)]
        public required List<List<int>> Medium { get; set; }
        [JsonProperty("expert", Required = Required.Always)]
        public required List<List<int>> Expert { get; set; }
    }


}