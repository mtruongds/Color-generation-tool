import type { ScaleContext } from './export-utils';
import type { Foundations } from './foundations';
import type { PaletteConfig } from '../components/palette-generator/types';

/** Everything a project holds: what undo tracks and what a version snapshots. */
export interface ProjectData {
  palettes: PaletteConfig[];
  backgrounds: ScaleContext['backgrounds'];
  foundations: Foundations;
}

export interface ProjectVersion {
  id: string;
  label: string;
  createdAt: number;
  data: ProjectData;
}

export interface Project {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  data: ProjectData;
  /** Saved by hand, newest first. */
  versions: ProjectVersion[];
}

export interface ProjectStore {
  activeId: string;
  projects: Project[];
}

export const PROJECTS_KEY = 'lumina_projects';
const MAX_VERSIONS = 50;

export const newProjectId = () => Math.random().toString(36).slice(2, 11);

export function loadProjectStore(): ProjectStore | null {
  try {
    const parsed = JSON.parse(localStorage.getItem(PROJECTS_KEY) ?? 'null');
    if (parsed && typeof parsed.activeId === 'string' && Array.isArray(parsed.projects) && parsed.projects.length) {
      return parsed as ProjectStore;
    }
  } catch {
    // A corrupted store starts over from the working copy.
  }
  return null;
}

export function saveProjectStore(store: ProjectStore) {
  try {
    localStorage.setItem(PROJECTS_KEY, JSON.stringify(store));
  } catch {
    // Storage full or blocked: projects still work for this session.
  }
}

export function createProject(name: string, data: ProjectData): Project {
  const now = Date.now();
  return { id: newProjectId(), name, createdAt: now, updatedAt: now, data, versions: [] };
}

export function addVersion(project: Project, label: string, data: ProjectData): Project {
  const version: ProjectVersion = { id: newProjectId(), label, createdAt: Date.now(), data };
  return { ...project, versions: [version, ...project.versions].slice(0, MAX_VERSIONS) };
}

/** A name not used by another project: "Untitled", then "Untitled 2", … */
export function uniqueProjectName(base: string, projects: Project[]) {
  const taken = new Set(projects.map((p) => p.name.toLowerCase()));
  if (!taken.has(base.toLowerCase())) return base;
  let n = 2;
  while (taken.has(`${base} ${n}`.toLowerCase())) n++;
  return `${base} ${n}`;
}

// ============================================================
// Project files
// ============================================================

interface ProjectFile {
  _meta: { app: 'Lumina'; kind: 'project'; version: 1; exportedAt: string };
  name: string;
  data: ProjectData;
}

export function projectFileContent(project: Pick<Project, 'name'>, data: ProjectData) {
  const file: ProjectFile = {
    _meta: { app: 'Lumina', kind: 'project', version: 1, exportedAt: new Date().toISOString() },
    name: project.name,
    data,
  };
  return JSON.stringify(file, null, 2);
}

export const projectFileName = (name: string) =>
  `${name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'project'}.lumina.json`;

/** Reads a project file, or a preset file's first preset, into a name and its data. */
export function parseProjectFile(text: string): { name: string; data: Omit<ProjectData, 'backgrounds'> & Partial<Pick<ProjectData, 'backgrounds'>> } {
  const raw = JSON.parse(text);
  if (raw?._meta?.kind === 'project' && Array.isArray(raw.data?.palettes)) {
    return { name: String(raw.name || 'Imported project'), data: raw.data };
  }
  // Preset exports hold a list; the first one becomes the project
  const preset = Array.isArray(raw?.presets) ? raw.presets[0] : Array.isArray(raw) ? raw[0] : null;
  if (preset && Array.isArray(preset.palettes)) {
    return { name: String(preset.name || 'Imported project'), data: { palettes: preset.palettes, foundations: preset.foundations } };
  }
  throw new Error('Not a Lumina project or preset file');
}

/** Opens a file picker and resolves with the chosen file's text. */
export function pickTextFile(accept = '.json'): Promise<string | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return resolve(null);
      file.text().then(resolve, () => resolve(null));
    };
    input.click();
  });
}
