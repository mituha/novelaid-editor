
export interface GitFileStatus {
  path: string;
  index: string;
  working_dir: string;
}

export interface GitLogEntry {
  hash: string;
  date: string;
  message: string;
  author_name: string;
  author_email: string;
  refs: string;
}
