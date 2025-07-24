namespace BoomyBuilder.Builder.Utils
{

    /// <summary>
    /// Represents a tempo change event at a specific measure position.
    /// </summary>
    public class TempoChange
    {
        public double Measure { get; set; }
        public double BPM { get; set; }

        public TempoChange(double measure, double bpm)
        {
            Measure = measure;
            BPM = bpm;
        }
    }

    /// <summary>
    /// Converts musical measure positions to frames, supporting static and variable tempo maps (Rock Band style).
    /// </summary>
    public class TempoMapConverter
    {
        private readonly int _ticksPerBeat;
        private readonly double _fps;
        private readonly int _timeSigNum;
        private readonly int _timeSigDenom;
        private readonly List<TempoChange> _tempoMap;

        /// <summary>
        /// Create a TempoMapConverter with a static BPM (no tempo changes).
        /// </summary>
        public TempoMapConverter(
            int ticksPerBeat = 480,
            double fps = 30.0,
            double staticBpm = 120.0,
            int timeSigNum = 4,
            int timeSigDenom = 4)
        {
            _ticksPerBeat = ticksPerBeat;
            _fps = fps;
            _timeSigNum = timeSigNum;
            _timeSigDenom = timeSigDenom;
            _tempoMap = new List<TempoChange>
            {
                new TempoChange(0, staticBpm)
            };
        }

        /// <summary>
        /// Create a TempoMapConverter with a variable tempo map.
        /// </summary>
        public TempoMapConverter(
            List<TempoChange> tempoMap,
            int ticksPerBeat = 480,
            double fps = 30.0,
            int timeSigNum = 4,
            int timeSigDenom = 4)
        {
            _ticksPerBeat = ticksPerBeat;
            _fps = fps;
            _timeSigNum = timeSigNum;
            _timeSigDenom = timeSigDenom;
            _tempoMap = tempoMap ?? throw new ArgumentNullException(nameof(tempoMap));
            if (_tempoMap.Count == 0)
                throw new ArgumentException("Tempo map must not be empty.");
        }

        /// <summary>
        /// Converts a measure number to the starting frame (double, supports variable tempo).
        /// </summary>
        public double MeasureToFrame(double measure, int beatOffset = 0)
        {
            double tick = MeasureToTick(measure, beatOffset);
            double seconds = TickToSecondsWithTempoMap(tick);
            return seconds * _fps;
        }

        /// <summary>
        /// Converts a measure number to the starting tick (RB3 logic with time signature).
        /// </summary>
        public double MeasureToTick(double measure)
        {
            return MeasureToTick(measure, 0);
        }

        /// <summary>
        /// Converts a measure number to the starting tick, with optional beat offset.
        /// </summary>
        public double MeasureToTick(double measure, int beatOffset)
        {
            double ticksPerMeasure = _timeSigNum * 1920.0 / _timeSigDenom;
            double ticksPerBeat = 1920.0 / _timeSigDenom;
            return measure * ticksPerMeasure + beatOffset * ticksPerBeat;
        }

        /// <summary>
        /// Converts a tick value to seconds, using the current tempo map (supports tempo changes).
        /// </summary>
        public double TickToSecondsWithTempoMap(double targetTick)
        {
            double totalSeconds = 0.0;
            double currentTick = 0.0;

            for (int i = 0; i < _tempoMap.Count; i++)
            {
                // Convert measure to tick for segment start
                double segmentStartTick = MeasureToTick(_tempoMap[i].Measure);
                double bpm = _tempoMap[i].BPM;

                // Convert measure to tick for segment end
                double segmentEndTick = (i + 1 < _tempoMap.Count)
                    ? MeasureToTick(_tempoMap[i + 1].Measure)
                    : targetTick;
                if (segmentEndTick > targetTick)
                    segmentEndTick = targetTick;

                if (segmentStartTick >= targetTick)
                    break;

                double start = Math.Max(segmentStartTick, currentTick);
                double ticksInSegment = segmentEndTick - start;
                if (ticksInSegment <= 0)
                    continue;

                double beats = ticksInSegment / _ticksPerBeat;
                double seconds = beats * 60.0 / bpm;
                totalSeconds += seconds;

                currentTick = segmentEndTick;
                if (currentTick >= targetTick)
                    break;
            }

            return totalSeconds;
        }

        /// <summary>
        /// Converts a tick value to seconds using the first BPM only (no tempo changes).
        /// </summary>
        public double TickToSeconds(double tick)
        {
            double bpm = _tempoMap[0].BPM;
            double beats = tick / _ticksPerBeat;
            return beats * 60.0 / bpm;
        }

        /// <summary>
        /// Add a new tempo change to the map. Tempo changes must be added in measure order.
        /// </summary>
        public void AddTempoChange(double measure, double bpm)
        {
            if (_tempoMap.Count > 0 && measure < _tempoMap[_tempoMap.Count - 1].Measure)
                throw new ArgumentException("Tempo changes must be added in ascending measure order.");
            _tempoMap.Add(new TempoChange(measure, bpm));
        }

        /// <summary>
        /// Converts a beat (absolute, e.g. measure * beatsPerMeasure + beatInMeasure) to the corresponding frame (supports variable tempo).
        /// </summary>
        public double BeatToFrame(double beat)
        {
            // Convert beat to tick
            double tick = beat * _ticksPerBeat;
            double seconds = TickToSecondsWithTempoMap(tick);
            return seconds * _fps;
        }
    }
}