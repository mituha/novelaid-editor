export type NovelaidDocumentType = "novel" | "markdown" | "image" | "chat" | "gitDiff" | "browser" | "css" | "unknown" | "external";

export type NovelaidDirEntry = {
  name: string;
  path: string;
  isDirectory: boolean;
  documentType: NovelaidDocumentType;
  children: Array<NovelaidDirEntry> | null;
  metadata?: any;
};
