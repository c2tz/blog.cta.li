export interface GitDates {
  createdAt: string;
  createdCommit?: string;
  lastModified: string;
  lastModifiedCommit?: string;
}

export function getFileGitDates(filePath: string): GitDates;
export function getContentEntryGitDates(collection: string, entry: unknown): GitDates;

export function hasDistinctModification(dates: {
  createdAt: Date | string;
  createdCommit?: string;
  lastModified: Date | string;
  lastModifiedCommit?: string;
}): boolean;
