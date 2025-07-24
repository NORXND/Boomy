using BoomyBuilder.Builder.Models;
using BoomyBuilder.Builder.Models.Drums;
using BoomyBuilder.Builder.Models.SongEvent;
using BoomyBuilder.Builder.Utils;
using Melanchall.DryWetMidi.Common;
using Melanchall.DryWetMidi.Core;
using Melanchall.DryWetMidi.Interaction;
using Melanchall.DryWetMidi.MusicTheory;
using Newtonsoft.Json;
using System;
using System.Collections.Generic;
using System.Linq;

namespace BoomyBuilder.Builder
{
    public class MidiMaker
    {
        private const int PPQ = 480; // Pulses per quarter note
        private const int BEATS_PER_MEASURE = 4; // Assuming 4/4

        static int BeatToTick(double beat) => (int)(beat * PPQ);

        static int MeasureToTick(double measure) => (int)(measure * BEATS_PER_MEASURE * PPQ);

        static SevenBitNumber NoteNameToNumber((NoteName, int, string) noteName)
        {
            // Parse note name like "C1", "D#2", etc.
            return NoteUtilities.GetNoteNumber(noteName.Item1, noteName.Item2);
        }

        public static void CreateMidi(
            BuildOperator op,
            List<Drumer.MidiEvent> events)
        {
            var midiFile = new MidiFile();
            midiFile.TimeDivision = new TicksPerQuarterNoteTimeDivision(PPQ);

            // Track 0: Tempo changes, named XYZ
            var tempoTrack = new TrackChunk();
            tempoTrack.Events.Add(new SequenceTrackNameEvent(Path.GetFileName(op.Request.Path)));

            long lastTick1 = 0;
            foreach (var tempo in op.Request.TempoChange)
            {
                var tick = MeasureToTick(tempo.Measure);
                var tempoEvent = new SetTempoEvent(Tempo.FromBeatsPerMinute(tempo.BPM).MicrosecondsPerQuarterNote)
                {
                    DeltaTime = tick - lastTick1
                };
                tempoTrack.Events.Add(tempoEvent);
                lastTick1 = tick;
            }
            midiFile.Chunks.Add(tempoTrack);

            // Track 1: General Text events, named EVENTS
            var textTrack = new TrackChunk();
            textTrack.Events.Add(new SequenceTrackNameEvent("EVENTS"));

            foreach (var evt in op.Request.Events)
            {
                int tick = BeatToTick(evt.Beat);
                string value = evt.Type switch
                {
                    SongEventType.MusicStart => "[music_start]",
                    SongEventType.Preview => "[preview]",
                    SongEventType.FreestyleStart => "[freestyle_start]",
                    SongEventType.FreestyleEnd => "[freestyle_end]",
                    SongEventType.MusicEnd => "[music_end]",
                    SongEventType.End => "[end]",
                };

                // Calculate the last absolute tick by summing DeltaTimes
                long lastTick2 = 0;
                foreach (var ev in textTrack.Events)
                {
                    lastTick2 += ev.DeltaTime;
                }

                textTrack.Events.Add(new TextEvent(value)
                {
                    DeltaTime = tick - lastTick2
                });
            }
            midiFile.Chunks.Add(textTrack);

            // Track 2: Drums, named DRUMS
            var drumsTrack = new TrackChunk();
            drumsTrack.Events.Add(new SequenceTrackNameEvent("DRUMS"));

            // Collect all drum events as (tick, noteNumber, isOn)
            var drumEvents = new List<(int tick, SevenBitNumber note, bool isOn)>();

            foreach (var drums in events)
            {
                var noteNumber = NoteNameToNumber(drums.Key);
                foreach (var beatIndex in drums.Keys)
                {
                    double beat = beatIndex / 2.0;
                    int tick = BeatToTick(beat);
                    drumEvents.Add((tick, noteNumber, true)); // NoteOn
                    drumEvents.Add((tick + (int)(PPQ * 0.5), noteNumber, false)); // NoteOff, 1/2 beat later
                }
            }

            // Sort all drum events by tick, NoteOff after NoteOn if same tick
            drumEvents = drumEvents
                .OrderBy(e => e.tick)
                .ThenBy(e => e.isOn ? 0 : 1)
                .ToList();

            // Write to track with correct delta times
            int lastTick = 0;
            foreach (var (tick, note, isOn) in drumEvents)
            {
                int delta = tick - lastTick;
                if (delta < 0) delta = 0; // Safety, should not happen if sorted

                if (isOn)
                    drumsTrack.Events.Add(new NoteOnEvent(note, (SevenBitNumber)100) { DeltaTime = delta });
                else
                    drumsTrack.Events.Add(new NoteOffEvent(note, (SevenBitNumber)0) { DeltaTime = delta });

                lastTick = tick;
            }

            midiFile.Chunks.Add(drumsTrack);

            string outputPath = Path.Combine(op.Request.OutPath, "songs", Path.GetFileName(op.Request.Path), $"{Path.GetFileName(op.Request.Path)}.mid");

            midiFile.Write(outputPath, true);
        }
    }
}