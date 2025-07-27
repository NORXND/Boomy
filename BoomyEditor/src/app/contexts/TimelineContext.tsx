import { TempoChange } from "@/types/song";
import React, { createContext, useContext, useState, ReactNode } from "react";

interface TimeSignature {
  numerator: number;
  denominator: number;
  ticks: number;
}

interface Measure {
  number: number;
  startTime: number; // in seconds
  duration: number; // in seconds
  startBeat: number;
  beatCount: number;
  bpm: number;
}

interface TimelineData {
  measures: Measure[];
  totalDuration: number;
  totalBeats: number;
  tempoChanges: TempoChange[];
  timeSignatures: TimeSignature[];
}

interface TimelineContextType {
  currentTime: number;
  setCurrentTime: (time: number) => void;
  isPlaying: boolean;
  setIsPlaying: (playing: boolean) => void;
  duration: number;
  setDuration: (duration: number) => void;
  timelineData: TimelineData | null;
  setTimelineData: (data: TimelineData | null) => void;
}

const TimelineContext = createContext<TimelineContextType | undefined>(undefined);

export function TimelineProvider({ children }: { children: ReactNode }) {
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [timelineData, setTimelineData] = useState<TimelineData | null>(null);

  return (
    <TimelineContext.Provider
      value={{
        currentTime,
        setCurrentTime,
        isPlaying,
        setIsPlaying,
        duration,
        setDuration,
        timelineData,
        setTimelineData,
      }}
    >
      {children}
    </TimelineContext.Provider>
  );
}

export function useTimelineContext() {
  const context = useContext(TimelineContext);
  if (context === undefined) {
    throw new Error("useTimelineContext must be used within a TimelineProvider");
  }
  return context;
}
