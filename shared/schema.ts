import { z } from "zod";

// Scan Request Schema
export const scanRequestSchema = z.object({
  domain: z.string().min(1, "Domain is required"),
  year: z.string().optional(),
  keyword: z.string().min(1, "Keyword is required"),
  limit: z.number().default(100),
});

export type ScanRequest = z.infer<typeof scanRequestSchema>;

// Scan Match Types
export type MatchType = "TEXT" | "JS" | "COMMENT";

export interface ScanMatch {
  timestamp: string;
  archiveUrl: string;
  matchType: MatchType;
  snippet: string;
}

// Scan Progress (for SSE updates)
export interface ScanProgress {
  type: "progress" | "match" | "complete" | "error";
  message?: string;
  currentSnapshot?: number;
  totalSnapshots?: number;
  match?: ScanMatch;
  error?: string;
}

// Use Case for Reference Table
export interface UseCase {
  category: string;
  keywords: string;
  description: string;
}

export const useCases: UseCase[] = [
  {
    category: "Data Leaks",
    keywords: "password, API_KEY, token, client_secret",
    description: "Finds hardcoded secrets developers forgot to delete"
  },
  {
    category: "Malware",
    keywords: "iframe, eval, script, base64",
    description: "Finds malicious code injection or hidden redirects"
  },
  {
    category: "Defacement",
    keywords: "hacked by, owned, security, pwned",
    description: "Finds hacker signatures left on the page"
  },
  {
    category: "Hidden Info",
    keywords: "ctf{, flag{, TODO, FIXME, admin, debug",
    description: "Finds developer comments or CTF flags"
  }
];
