import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import {
  loadPreferences,
  savePreferences,
  BoomyPreferences,
  deletePreferences,
} from "./lib/preferencesManager";

interface PreferencesDialogProps {
  open: boolean;
  setOpen: (open: boolean) => void;
}

export function PreferencesDialog({
  open,
  setOpen,
}: PreferencesDialogProps) {
  const [prefs, setPrefs] = useState<BoomyPreferences>({
    defaultMiloMovePath: "",
    defaultHambuildPath: "",
    lastOpenedProjects: [],
  });
  const [isLoading, setIsLoading] = useState(true);
  const [hasChanges, setHasChanges] = useState(false);

  // Load preferences when dialog opens
  useEffect(() => {
    if (open) {
      loadAndDisplayPrefs();
    }
  }, [open]);

  const loadAndDisplayPrefs = async () => {
    try {
      setIsLoading(true);
      const loadedPrefs = await loadPreferences();
      setPrefs(loadedPrefs);
      setHasChanges(false);
    } catch (error) {
      toast.error("Failed to load preferences");
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleMiloPathChange = (value: string) => {
    setPrefs({ ...prefs, defaultMiloMovePath: value });
    setHasChanges(true);
  };

  const handleHambuildPathChange = (value: string) => {
    setPrefs({ ...prefs, defaultHambuildPath: value });
    setHasChanges(true);
  };

  const handleSelectMiloPath = async () => {
    try {
      const result = (await window.electronAPI.selectDirectoryPath({
        title: "Select Default Milo Move Library Path",
      })) as string | null;

      if (result) {
        handleMiloPathChange(result);
      }
    } catch (error) {
      toast.error("Failed to select directory");
      console.error(error);
    }
  };

  const handleSelectHambuildPath = async () => {
    try {
      const result = (await window.electronAPI.selectFilePath({
        title: "Select Hambuild Executable",
        fileTypes: [
          { name: "Executables", extensions: ["exe", ""] },
          { name: "All Files", extensions: ["*"] },
        ],
      })) as string | null;

      if (result) {
        handleHambuildPathChange(result);
      }
    } catch (error) {
      toast.error("Failed to select file");
      console.error(error);
    }
  };

  const handleClearMiloPath = () => {
    handleMiloPathChange("");
  };

  const handleClearHambuildPath = () => {
    handleHambuildPathChange("");
  };

  const handleDeletePrefs = async () => {
    if (!confirm("Are you sure you want to delete all preferences?")) {
      return;
    }

    try {
      await deletePreferences();
      setPrefs({
        defaultMiloMovePath: "",
        defaultHambuildPath: "",
        lastOpenedProjects: [],
      });
      setHasChanges(false);
      setOpen(false);
      toast.success("Preferences deleted");
    } catch (error) {
      toast.error("Failed to delete preferences");
      console.error(error);
    }
  };

  const handleSave = async () => {
    try {
      await savePreferences(prefs);
      setHasChanges(false);
      setOpen(false);
      toast.success("Preferences saved");
    } catch (error) {
      toast.error("Failed to save preferences");
      console.error(error);
    }
  };

  const handleCancel = () => {
    if (hasChanges) {
      if (!confirm("You have unsaved changes. Discard them?")) {
        return;
      }
    }
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Preferences</DialogTitle>
          <DialogDescription>
            Configure default paths and manage project history
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="py-8 text-center text-gray-400">Loading...</div>
        ) : (
          <div className="space-y-6 py-4">
            {/* Milo Move Library Path */}
            <div className="space-y-2">
              <Label htmlFor="milo-path">Default Milo Move Library Path</Label>
              <div className="flex gap-2">
                <Input
                  id="milo-path"
                  value={prefs.defaultMiloMovePath || ""}
                  onChange={(e) => handleMiloPathChange(e.target.value)}
                  placeholder="Leave empty for no default"
                  className="flex-1"
                />
                <Button
                  onClick={handleSelectMiloPath}
                  variant="outline"
                  size="sm"
                >
                  Browse
                </Button>
                {prefs.defaultMiloMovePath && (
                  <Button
                    onClick={handleClearMiloPath}
                    variant="outline"
                    size="sm"
                  >
                    Clear
                  </Button>
                )}
              </div>
              <p className="text-xs text-gray-400">
                This path will be used when a project doesn't specify a milo
                move library or the specified path is invalid.
              </p>
            </div>

            {/* Hambuild Path */}
            <div className="space-y-2">
              <Label htmlFor="hambuild-path">Default Hambuild Executable</Label>
              <div className="flex gap-2">
                <Input
                  id="hambuild-path"
                  value={prefs.defaultHambuildPath || ""}
                  onChange={(e) => handleHambuildPathChange(e.target.value)}
                  placeholder="Leave empty for no default"
                  className="flex-1"
                />
                <Button
                  onClick={handleSelectHambuildPath}
                  variant="outline"
                  size="sm"
                >
                  Browse
                </Button>
                {prefs.defaultHambuildPath && (
                  <Button
                    onClick={handleClearHambuildPath}
                    variant="outline"
                    size="sm"
                  >
                    Clear
                  </Button>
                )}
              </div>
              <p className="text-xs text-gray-400">
                Path to the hambuild executable file (e.g., hambuild.exe).
              </p>
            </div>

            {/* Danger Zone */}
            <div className="space-y-2 pt-4 border-t">
              <Label className="text-red-400">Danger Zone</Label>
              <Button
                onClick={handleDeletePrefs}
                variant="destructive"
                className="w-full"
              >
                Delete All Preferences
              </Button>
              <p className="text-xs text-gray-400">
                This will delete the .boomy-prefs file from your home directory.
                This action cannot be undone.
              </p>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={handleCancel}>
            {hasChanges ? "Discard" : "Close"}
          </Button>
          <Button onClick={handleSave} disabled={!hasChanges || isLoading}>
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
