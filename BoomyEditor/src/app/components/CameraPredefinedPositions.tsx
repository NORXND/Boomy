import React from "react";
import { Camera } from "lucide-react";
import { cn } from "@/lib/utils";
import { CameraPosition } from "../types/song";

export function CameraPredefinedPositions() {
  // Get all camera positions from the enum
  const cameraPositions = Object.values(CameraPosition);

  // Camera position display names
  const cameraDisplayNames: Record<CameraPosition, string> = {
    [CameraPosition.Venue]: "Venue",
    [CameraPosition.Closeup]: "Close-up",
    [CameraPosition.Area1Near]: "Area 1 Near",
    [CameraPosition.Area1Movement]: "Area 1 Movement",
    [CameraPosition.Area1Wide]: "Area 1 Wide",
    [CameraPosition.Area1Far]: "Area 1 Far",
    [CameraPosition.Area2Near]: "Area 2 Near",
    [CameraPosition.Area2Movement]: "Area 2 Movement",
    [CameraPosition.Area2Wide]: "Area 2 Wide",
    [CameraPosition.Area2Far]: "Area 2 Far",
    [CameraPosition.Area3Near]: "Area 3 Near",
    [CameraPosition.Area3Movement]: "Area 3 Movement",
    [CameraPosition.Area3Wide]: "Area 3 Wide",
    [CameraPosition.Area3Far]: "Area 3 Far",
  };

  const handleDragStart = (e: React.DragEvent, cameraPosition: CameraPosition) => {
    // Store drag data for camera position
    const dragData = {
      type: "camera-position",
      position: cameraPosition,
      displayName: cameraDisplayNames[cameraPosition],
    };
    e.dataTransfer.setData("application/json", JSON.stringify(dragData));
    e.dataTransfer.effectAllowed = "copy";
  };

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0 p-4 border-b space-y-3">
        <h2 className="text-lg font-semibold">Camera Positions</h2>
        <div className="text-xs text-muted-foreground">{cameraPositions.length} camera angles available</div>
      </div>

      {/* Content area */}
      <div className="flex-1 overflow-auto p-4">
        <div className="space-y-3">
          {cameraPositions.map((position) => {
            const displayName = cameraDisplayNames[position];

            return (
              <div
                key={position}
                className={cn("p-3 border rounded-lg cursor-move transition-colors", "hover:bg-muted/50 hover:border-primary/50", "bg-card border-border")}
                draggable={true}
                onDragStart={(e) => handleDragStart(e, position)}
                title={`Drag to timeline: ${displayName}`}
              >
                <div className="flex items-center gap-3">
                  {/* Camera icon */}
                  <div className="flex-shrink-0 w-12 h-12 bg-primary/10 rounded border flex items-center justify-center">
                    <Camera className="h-6 w-6 text-primary" />
                  </div>

                  {/* Camera info */}
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-semibold truncate">{displayName}</h3>
                    <div className="text-xs text-muted-foreground mt-1">Camera Position: {position}</div>
                  </div>

                  {/* Drag indicator */}
                  <div className="flex-shrink-0 opacity-50">
                    <div className="w-2 h-2 bg-muted-foreground rounded-full"></div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
