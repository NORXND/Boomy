import React, { useState } from "react";
import { useBamPhrases, useSongStore } from "@/store/songStore";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

export function BamPhrasesEditor() {
  const bamPhrases = useBamPhrases();
  const { addBamPhrase, removeBamPhrase, updateBamPhrase } = useSongStore();

  const [newCount, setNewCount] = useState<number>(1);
  const [newBars, setNewBars] = useState<number>(1);

  return (
    <div className="space-y-4 p-4">
      <h2 className="font-bold text-lg">Bam Phrases</h2>
      <div className="text-xs text-muted-foreground mb-2">
        <span className="block">
          <strong>Count</strong> – How many times this bar phrasing repeats.
        </span>
        <span className="block">
          <strong>Bars</strong> – How many bars per phrase.
        </span>
      </div>
      <form
        className="flex items-center gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          addBamPhrase({ count: newCount, bars: newBars });
        }}
      >
        <div>
          <Label className="block text-xs text-muted-foreground mb-1">Count (1 - 100)</Label>
          <Input type="number" min={1} max={100} step={1} value={newCount} onChange={(e) => setNewCount(Number(e.target.value))} className="w-20" placeholder="Count" />
        </div>
        <div>
          <Label className="block text-xs text-muted-foreground mb-1">Bars (1 - 100)</Label>
          <Input type="number" min={1} max={100} step={1} value={newBars} onChange={(e) => setNewBars(Number(e.target.value))} className="w-20" placeholder="Bars" />
        </div>
        <Button type="submit" size="sm">
          Add
        </Button>
      </form>
      <hr className="my-4" />
      <ul className="space-y-2">
        {bamPhrases && bamPhrases.length > 0 ? (
          bamPhrases.map((phrase, idx) => (
            <li key={idx} className="flex items-center gap-4">
              <div>
                <Label className="block text-xs text-muted-foreground mb-1">Count (1 - 100)</Label>
                <Input
                  type="number"
                  min={1}
                  max={100}
                  step={1}
                  value={phrase.count}
                  onChange={(e) =>
                    updateBamPhrase(idx, {
                      count: Number(e.target.value),
                    })
                  }
                  className="w-20"
                />
              </div>
              <div>
                <Label className="block text-xs text-muted-foreground mb-1">Bars (1 - 100)</Label>
                <Input
                  type="number"
                  min={1}
                  max={100}
                  step={1}
                  value={phrase.bars}
                  onChange={(e) =>
                    updateBamPhrase(idx, {
                      bars: Number(e.target.value),
                    })
                  }
                  className="w-20"
                />
              </div>
              <Button variant="destructive" size="sm" onClick={() => removeBamPhrase(idx)} title="Delete">
                ✕
              </Button>
            </li>
          ))
        ) : (
          <li className="text-muted-foreground">No Bam Phrases</li>
        )}
      </ul>
    </div>
  );
}
