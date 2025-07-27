import { useState } from "react";
import { Button } from "./components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "./components/ui/dialog";
import { Input } from "./components/ui/input";
import { Label } from "./components/ui/label";

export function hashRandomId(str: string): number {
  // Include current timestamp for better uniqueness
  const timestamp = Date.now();
  const combinedString = `${str}-${timestamp}`;

  let hash = 0x811c9dc5; // FNV-1a 32-bit offset basis
  for (let i = 0; i < combinedString.length; i++) {
    hash ^= combinedString.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) | 0; // FNV prime, keep 32 bits, signed
    hash ^= (hash << 13) | 0;
    hash ^= hash >> 7;
  }

  // Final avalanche
  hash ^= (hash << 11) | 0;
  hash ^= hash >> 17;

  // Return as signed 32-bit integer
  return hash | 0;
}

export function RandomIdGenerator({ open, setOpen }: { open: boolean; setOpen: (open: boolean) => void }) {
  const [name, setName] = useState("");
  const [artist, setArtist] = useState("");
  const [randomHash, setRandomHash] = useState("");

  return (
    <Dialog
      open={open}
      onOpenChange={(open) => {
        setName("");
        setArtist("");
        setRandomHash("");
        setOpen(open);
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Generate Random ID for your song.</DialogTitle>
          <DialogDescription>Using special hashing algorithm, this tool will create a unique ID for your song based on Title and Artist.</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col items-center gap-2">
          <div className="flex items-center w-full gap-2 flex-row">
            <Label htmlFor="name" className="sr-only">
              Song Title
            </Label>
            <Input id="name" placeholder="Enter song title" onChange={(e) => setName(e.target.value)} value={name} />
          </div>
          <div className="flex items-center w-full gap-2">
            <Label htmlFor="artist" className="sr-only">
              Artist Name
            </Label>
            <Input id="artist" placeholder="Enter artist name" onChange={(e) => setArtist(e.target.value)} value={artist} />
          </div>
        </div>
        <DialogFooter className="sm:justify-start">
          <Button
            onClick={() => {
              if (name && artist) {
                const id = hashRandomId(`${name}-${artist}`);
                setRandomHash(id.toString());
              }
            }}
          >
            Generate Random ID
          </Button>
          <Input readOnly value={randomHash} />
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
