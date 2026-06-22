export interface GitDates {
  createdAt: string;
  createdCommit?: string;
  lastModified: string;
  lastModifiedCommit?: string;
}

export function getFileGitDates(filePath: string): GitDates;
export function getContentEntryGitDates(
  collection: string,
  entry: unknown,
): GitDates;
