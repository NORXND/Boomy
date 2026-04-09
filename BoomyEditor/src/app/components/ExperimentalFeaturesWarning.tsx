import React from "react";
import { AlertTriangle } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ScrollArea } from "@/components/ui/scroll-area";

export interface ExperimentalFeatureLog {
  difficulty: "supereasy" | "easy" | "medium" | "expert";
  measure: number;
  move: string;
  features: string[];
}

interface ExperimentalFeaturesWarningProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  features: ExperimentalFeatureLog[];
  onContinue: () => void;
}

// Map feature names to user-friendly descriptions
const FEATURE_DESCRIPTIONS: Record<string, string> = {
  clear_left_footik_in: "Release left foot during in transition",
  clear_left_footik_out: "Release left foot during out transition",
  clear_right_footik_in: "Release right foot during in transition",
  clear_right_footik_out: "Release right foot during out transition",
  set_left_footik_in: "Plant left foot during in transition",
  set_left_footik_out: "Plant left foot during out transition",
  set_right_footik_in: "Plant right foot during in transition",
  set_right_footik_out: "Plant right foot during out transition",
  flip: "Horizontally flip move",
  loop_in: "Generate looping in transition",
  loop_out: "Generate looping out transition",
  loop_symmetric_in: "Generate symmetric looping in transition",
  loop_symmetric_out: "Generate symmetric looping out transition",
  merge_in: "Blend in transition (starts on beat 1 of move)",
  sequence: "Link to next move in Rehearse/Break It Down",
};

export const ExperimentalFeaturesWarning: React.FC<ExperimentalFeaturesWarningProps> = ({
  open,
  onOpenChange,
  features,
  onContinue,
}) => {
  const handleContinue = () => {
    onOpenChange(false);
    onContinue();
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-3xl">
        <AlertDialogHeader>
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            <AlertDialogTitle>HamBuild Move Features Enabled</AlertDialogTitle>
          </div>
          <AlertDialogDescription>
            Your song has {features.length} move{features.length !== 1 ? "s" : ""} with HamBuild-specific features enabled.
            These features require HamBuild processing and may affect how moves are built and displayed.
          </AlertDialogDescription>
        </AlertDialogHeader>

        {/* Scrollable list of moves with experimental features */}
        {features.length > 0 && (
          <div className="border rounded-lg p-3 bg-muted/30">
            <h4 className="text-sm font-semibold mb-2">Affected Moves:</h4>
            <ScrollArea className="h-48">
              <div className="space-y-3 pr-4">
                {features.map((item, idx) => (
                  <div key={idx} className="text-sm p-2 bg-background rounded border border-muted">
                    <div className="font-medium text-foreground">
                      [{item.difficulty}] {item.move} @ measure {item.measure}
                    </div>
                    <div className="text-xs text-muted-foreground mt-2 space-y-1">
                      {item.features.map((feature, fidx) => (
                        <div key={fidx} className="ml-2">
                          • <span className="font-mono text-xs">{feature}</span>: {FEATURE_DESCRIPTIONS[feature] || "Feature"}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>
        )}

        <div className="text-sm text-muted-foreground space-y-2">
          <p>
            <strong>HamBuild Feature Groups:</strong>
          </p>
          <div className="ml-2 space-y-2 text-xs">
            <div>
              <strong className="text-foreground">Footik Commands:</strong> Control foot placement during transitions
              (clear vs set, left vs right, in vs out transitions)
            </div>
            <div>
              <strong className="text-foreground">General Modifiers:</strong> Flip (horizontally mirror), merge_in (blend timing), sequence (link moves)
            </div>
            <div>
              <strong className="text-foreground">Loop Transitions:</strong> Generate new transitions for looping moves (standard or symmetric)
            </div>
          </div>
          <p className="text-xs pt-2 border-t border-muted">
            ℹ️ These features are processed by HamBuild.exe and integrated into your song's choreography data.
          </p>
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel>Cancel Build</AlertDialogCancel>
          <AlertDialogAction onClick={handleContinue} className="bg-amber-600 hover:bg-amber-700">
            Continue Building
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
