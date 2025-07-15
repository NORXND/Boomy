namespace BoomyBuilder.Builder.Models.Move
{
    using System.Collections.Generic;

    using System.Globalization;
    using BoomyBuilder.Builder.Models.Timeline;
    using Newtonsoft.Json;
    using Newtonsoft.Json.Converters;

    public partial class Move
    {
        public string Clip { get; set; }
        public Difficulty difficulty { get; set; }
        public string DisplayName { get; set; }
        public string HamMoveName { get; set; }
        public string MiloName { get; set; }
        public string SongName { get; set; }
        public float AvgBeatsPerSecond { get; set; }
        public string Genre { get; set; }
        public string Era { get; set; }
        public uint Flags { get; set; }
        public string LinkedFrom { get; set; }
        public string LinkedTo { get; set; }

        public class JsonedMove
        {
            [JsonProperty("name", Required = Required.Always)]
            public string name;
            [JsonProperty("difficulty", Required = Required.Always)]
            public int difficulty;
            [JsonProperty("display_name", Required = Required.Always)]
            public string displayName;
            [JsonProperty("ham_move_name", Required = Required.Always)]
            public string hamMoveName;
            [JsonProperty("milo_name", Required = Required.Always)]
            public string miloName;
            [JsonProperty("song_name", Required = Required.Always)]
            public string songName;
            [JsonProperty("clips", Required = Required.Always)]
            public Dictionary<string, JsonedClips> clips;
        }

        public class JsonedClips
        {
            [JsonProperty("avg_beats_per_second", Required = Required.Always)]
            public string avg_beats_per_second;
            [JsonProperty("genre", Required = Required.Always)]
            public string genre;
            [JsonProperty("era", Required = Required.Always)]
            public string era;
            [JsonProperty("flags", Required = Required.Always)]
            public uint flags;
            [JsonProperty("linked_to", Required = Required.Always)]
            public string linked_from;
            [JsonProperty("linked_from", Required = Required.Always)]
            public string linked_to;
        }

        public Move(MoveEvent data, BuildOperator op)
        {
            string movePath = Path.Combine(op.Request.MovesPath, data.MoveOriginPath, data.MoveSongPath, data.MovePath, "move.json");

            if (!File.Exists(movePath))
            {
                throw new Exception($"Move file not found: {movePath}");
            }

            using (StreamReader sr = File.OpenText(movePath))
            {
                JsonSerializer serializer = new JsonSerializer();
                serializer.Converters.Add(new StringEnumConverter());

                JsonedMove jsonedMove = (JsonedMove)serializer.Deserialize(sr, typeof(JsonedMove));

                // Map basic properties from JsonedMove
                DisplayName = jsonedMove.displayName;
                HamMoveName = jsonedMove.hamMoveName;
                MiloName = jsonedMove.miloName;
                SongName = jsonedMove.songName;
                difficulty = (Difficulty)jsonedMove.difficulty;

                // Select the specific clip based on data.Clip
                if (jsonedMove.clips.ContainsKey(data.Clip))
                {
                    JsonedClips selectedClip = jsonedMove.clips[data.Clip];

                    // Map clip-specific properties
                    Clip = data.Clip;
                    AvgBeatsPerSecond = float.Parse(selectedClip.avg_beats_per_second, CultureInfo.InvariantCulture);
                    Genre = selectedClip.genre;
                    Era = selectedClip.era;
                    Flags = selectedClip.flags;
                    LinkedFrom = selectedClip.linked_from;
                    LinkedTo = selectedClip.linked_to;
                }
                else
                {
                    throw new Exception($"Clip '{data.Clip}' not found in move file: {movePath}");
                }
            }
        }
    }
}