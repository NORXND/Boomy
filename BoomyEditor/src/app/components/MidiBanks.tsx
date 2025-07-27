import { useState, useEffect, useMemo } from "react";
import { X, Search, Plus, Music } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSongStore } from "../store/songStore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import path from "path-browserify";
import { toast } from "sonner";

interface MidiFile {
  name: string;
  path: string;
}

interface MidiBank {
  name: string;
  files: MidiFile[];
}

interface MidiBanksProps {
  onSelect?: (file: MidiFile) => void;
  onAddBankAsDrumTrack?: (bankName: string) => void;
  className?: string;
}

export function MidiBanks({ onSelect, onAddBankAsDrumTrack, className }: MidiBanksProps) {
  const song = useSongStore((state) => state.currentSong);
  const [banks, setBanks] = useState<MidiBank[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedBank, setSelectedBank] = useState<string | null>(null);

  // Fetch MIDI banks on component mount and when movelib path changes
  useEffect(() => {
    const fetchMidiBanks = async () => {
      if (!song?.move_lib) {
        setError("Movelib path not set in song configuration");
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      try {
        const midiBankDir = path.join(song.move_lib, "midi_bank");

        // Check if the directory exists
        const exists = await window.electronAPI.pathExists(midiBankDir);
        if (!exists) {
          setError(`MIDI bank directory not found: ${midiBankDir}`);
          setIsLoading(false);
          return;
        }

        // Read all items in the midi_bank folder
        const dirContents = await window.electronAPI.readDirectory(midiBankDir);

        // Filter to get only directories
        const bankDirs = dirContents.filter((item) => item.isDirectory);

        // Process each bank directory
        const banks = await Promise.all(
          bankDirs.map(async (bankDir) => {
            const bankPath = path.join(midiBankDir, bankDir.name);

            // Read all files in this bank directory
            const bankContents = await window.electronAPI.readDirectory(bankPath);

            // Filter for MIDI files
            const midiFiles = bankContents
              .filter((item) => item.isFile && (item.name.endsWith(".mid") || item.name.endsWith(".midi")))
              .map((item) => ({
                name: item.name,
                path: path.join(bankPath, item.name),
              }));

            return {
              name: bankDir.name,
              files: midiFiles,
            };
          }),
        );

        setBanks(banks);

        // Set the first bank as selected if there are banks
        if (banks.length > 0) {
          setSelectedBank(banks[0].name);
        }
      } catch (err) {
        console.error("Error loading MIDI banks:", err);
        setError(err instanceof Error ? err.message : "Failed to load MIDI banks");
        toast("Error", {
          description: "Failed to load MIDI banks",
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchMidiBanks();
  }, [song?.move_lib]);

  // Filter banks and files based on search query
  const filteredBanks = useMemo(() => {
    if (!searchQuery.trim()) {
      return banks;
    }

    const query = searchQuery.toLowerCase();

    return banks
      .map((bank) => ({
        ...bank,
        files: bank.files.filter((file) => file.name.toLowerCase().includes(query)),
      }))
      .filter((bank) => bank.files.length > 0);
  }, [banks, searchQuery]);

  // Get the currently selected bank
  const currentBank = useMemo(() => {
    return filteredBanks.find((bank) => bank.name === selectedBank) || null;
  }, [filteredBanks, selectedBank]);

  // Handle MIDI file selection
  const handleFileSelect = (file: MidiFile) => {
    if (onSelect) {
      onSelect(file);
      toast("MIDI Selected", {
        description: `Selected: ${file.name}`,
      });
    }
  };

  return (
    <div className={cn("flex flex-col h-full", className)}>
      {/* Header with search */}
      <div className="p-4 border-b">
        <h2 className="text-lg font-semibold mb-2">MIDI Banks</h2>
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input type="text" placeholder="Search MIDI files..." className="pl-8" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
          {searchQuery && (
            <button onClick={() => setSearchQuery("")} className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground">
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Content area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar with banks */}
        <div className="w-full overflow-y-auto">
          {isLoading ? (
            <div className="p-4 text-center text-muted-foreground">Loading...</div>
          ) : error ? (
            <div className="p-4 text-center text-destructive">{error}</div>
          ) : filteredBanks.length === 0 ? (
            <div className="p-4 text-center text-muted-foreground">No MIDI banks found</div>
          ) : (
            <ScrollArea className="h-full">
              <div className="p-2">
                {filteredBanks.map((bank) => (
                  <Button key={bank.name} variant={selectedBank === bank.name ? "default" : "ghost"} className="w-full justify-start mb-1" onClick={() => setSelectedBank(bank.name)}>
                    <Music className="h-4 w-4 mr-2" />
                    <span className="truncate">{bank.name}</span>
                    <div className="ml-auto flex items-center gap-1">
                      {onAddBankAsDrumTrack && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 p-1"
                          onClick={(e) => {
                            e.stopPropagation();
                            onAddBankAsDrumTrack(bank.name);
                            toast("Track Added", {
                              description: `Added ${bank.name} as drum track`,
                            });
                          }}
                          title="Add as Drum Track"
                        >
                          <Plus className="h-3 w-3" />
                        </Button>
                      )}
                      <span className="text-xs text-muted-foreground">{bank.files.length}</span>
                    </div>
                  </Button>
                ))}
              </div>
            </ScrollArea>
          )}
        </div>
      </div>
    </div>
  );
}
