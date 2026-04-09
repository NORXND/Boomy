declare global {
  interface Window {
    electronAPI: any;
  }
}

export interface BoomyPreferences {
  defaultMiloMovePath?: string;
  defaultHambuildPath?: string;
  lastOpenedProjects: string[];
}

/**
 * Load preferences from the prefs file
 */
export async function loadPreferences(): Promise<BoomyPreferences> {
  try {
    // Call the main process to get the prefs file path
    const content = await window.electronAPI.invoke("prefs:load");
    // Skip first line (pref1) and parse the JSON from line 2 onwards
    const lines = content.split("\n");
    const jsonContent = lines.slice(1).join("\n");
    const prefs: BoomyPreferences = JSON.parse(jsonContent);
    return prefs;
  } catch (error) {
    // If file doesn't exist or is invalid, return defaults
    return {
      defaultMiloMovePath: "",
      defaultHambuildPath: "",
      lastOpenedProjects: [],
    };
  }
}

/**
 * Save preferences to the prefs file
 */
export async function savePreferences(
  prefs: BoomyPreferences,
): Promise<void> {
  // Format: first line is "pref1", then JSON content
  const jsonContent = JSON.stringify(prefs, null, 2);
  const content = `pref1\n${jsonContent}`;
  await window.electronAPI.invoke("prefs:save", content);
}

/**
 * Add a project to the last opened projects list
 * Moves it to the top if it already exists
 */
export async function addToLastOpened(projectPath: string): Promise<void> {
  const prefs = await loadPreferences();

  // Remove if already exists
  prefs.lastOpenedProjects = prefs.lastOpenedProjects.filter(
    (p) => p !== projectPath,
  );

  // Add to the beginning
  prefs.lastOpenedProjects.unshift(projectPath);

  // Keep only the last 10 projects
  prefs.lastOpenedProjects = prefs.lastOpenedProjects.slice(0, 10);

  await savePreferences(prefs);
}

/**
 * Get the effective milo move library path
 * Uses default from preferences
 */
export async function getEffectiveMiloMovePath(): Promise<string> {
  const prefs = await loadPreferences();
  return prefs.defaultMiloMovePath || "";
}

/**
 * Get the effective hambuild path
 * Uses default from preferences
 */
export async function getEffectiveHambuildPath(): Promise<string> {
  const prefs = await loadPreferences();
  return prefs.defaultHambuildPath || "";
}

/**
 * Delete the preferences file
 */
export async function deletePreferences(): Promise<void> {
  try {
    await window.electronAPI.invoke("prefs:delete");
  } catch {
    // File might not exist, that's okay
  }
}

/**
 * Check if preferences file exists
 */
export async function preferencesFileExists(): Promise<boolean> {
  try {
    await window.electronAPI.invoke("prefs:exists");
    return true;
  } catch {
    return false;
  }
}
