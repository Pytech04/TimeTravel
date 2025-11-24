import type { Express } from "express";
import { createServer, type Server } from "http";
import * as cheerio from "cheerio";
import { scanRequestSchema, type ScanProgress, type ScanMatch } from "@shared/schema";

const CDX_API = "https://web.archive.org/cdx/search/cdx";
const TIMEOUT = 60000;
const HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36",
  "Referer": "https://web.archive.org/"
};

interface Snapshot {
  timestamp: string;
  original: string;
}

async function fetchSnapshots(domain: string, year?: string, limit: number = 100): Promise<Snapshot[]> {
  const params = new URLSearchParams({
    url: domain,
    output: "json",
    fl: "timestamp,original",
    filter: "statuscode:200",
    limit: limit.toString()
  });

  if (year) {
    params.set("from", `${year}0101`);
    params.set("to", `${year}1231`);
  }

  try {
    const response = await fetch(`${CDX_API}?${params}`, {
      headers: HEADERS,
      signal: AbortSignal.timeout(TIMEOUT)
    });

    if (!response.ok) {
      throw new Error(`CDX API returned ${response.status}`);
    }

    const data = await response.json();
    
    if (!Array.isArray(data) || data.length <= 1) {
      return [];
    }

    // Skip header row and map to Snapshot objects
    return data.slice(1).map(([timestamp, original]) => ({
      timestamp,
      original
    }));
  } catch (error) {
    console.error("[Wayback] CDX API Error:", error);
    return [];
  }
}

function extractData(html: string, keyword: string, timestamp: string, archiveUrl: string): ScanMatch[] {
  const matches: ScanMatch[] = [];
  const $ = cheerio.load(html);
  
  // 1. CLEANUP: Remove Wayback Machine's injected Toolbar & Scripts
  $("#wm-ipp-base, #wm-ipp, #donato").remove();
  $('script[src*="archive.org"]').remove();

  const escapedKeyword = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  // 2. SEARCH VISIBLE TEXT - Find ALL occurrences
  const textContent = $("body").text().replace(/\s+/g, ' ').trim();
  const textPattern = new RegExp(escapedKeyword, 'gi');
  let match;
  
  while ((match = textPattern.exec(textContent)) !== null) {
    const start = Math.max(0, match.index - 30);
    const end = Math.min(textContent.length, match.index + keyword.length + 30);
    const snippet = "..." + textContent.substring(start, end).replace(/\n/g, " ") + "...";
    
    matches.push({
      timestamp,
      archiveUrl,
      matchType: "TEXT",
      snippet
    });
    
    // Prevent infinite loop on zero-width matches
    if (match.index === textPattern.lastIndex) {
      textPattern.lastIndex++;
    }
  }

  // 3. SEARCH JAVASCRIPT - Find ALL occurrences in each script tag
  $("script").each((_, script) => {
    const scriptContent = $(script).html();
    if (scriptContent) {
      const jsPattern = new RegExp(escapedKeyword, 'gi');
      let match;
      
      while ((match = jsPattern.exec(scriptContent)) !== null) {
        const start = Math.max(0, match.index - 30);
        const end = Math.min(scriptContent.length, match.index + keyword.length + 30);
        const snippet = "..." + scriptContent.substring(start, end).replace(/\n/g, " ").trim() + "...";
        
        matches.push({
          timestamp,
          archiveUrl,
          matchType: "JS",
          snippet
        });
        
        // Prevent infinite loop on zero-width matches
        if (match.index === jsPattern.lastIndex) {
          jsPattern.lastIndex++;
        }
      }
    }
  });

  // 4. SEARCH COMMENTS - Find ALL occurrences
  const htmlString = $.html();
  const commentRegex = /<!--([\s\S]*?)-->/g;
  let commentMatch;
  
  while ((commentMatch = commentRegex.exec(htmlString)) !== null) {
    const comment = commentMatch[1];
    
    // Skip Wayback Machine comments
    if (comment.includes("FILE ARCHIVED ON")) continue;
    
    const commentPattern = new RegExp(escapedKeyword, 'gi');
    let keywordMatch;
    
    while ((keywordMatch = commentPattern.exec(comment)) !== null) {
      const start = Math.max(0, keywordMatch.index - 30);
      const end = Math.min(comment.length, keywordMatch.index + keyword.length + 30);
      const snippet = "..." + comment.substring(start, end).trim() + "...";
      
      matches.push({
        timestamp,
        archiveUrl,
        matchType: "COMMENT",
        snippet
      });
      
      // Prevent infinite loop on zero-width matches
      if (keywordMatch.index === commentPattern.lastIndex) {
        commentPattern.lastIndex++;
      }
    }
  }

  return matches;
}

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function registerRoutes(app: Express): Promise<Server> {
  
  app.get("/api/scan", async (req, res) => {
    const { domain, year, keyword, limit } = req.query;

    // Validate input
    const validation = scanRequestSchema.safeParse({
      domain,
      year,
      keyword,
      limit: limit ? parseInt(limit as string) : 100
    });

    if (!validation.success) {
      res.status(400).json({ error: "Invalid parameters" });
      return;
    }

    const { domain: targetDomain, year: targetYear, keyword: searchKeyword, limit: snapshotLimit } = validation.data;

    // Set up SSE
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    const sendProgress = (data: ScanProgress) => {
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    // Track if client disconnected
    let clientConnected = true;

    req.on("close", () => {
      clientConnected = false;
      console.log("[SSE] Client disconnected, aborting scan");
    });

    try {
      // Fetch snapshots
      sendProgress({
        type: "progress",
        message: `Contacting Wayback Machine for: ${targetDomain}...`
      });

      const snapshots = await fetchSnapshots(targetDomain, targetYear, snapshotLimit);

      if (snapshots.length === 0) {
        sendProgress({
          type: "complete",
          message: "No snapshots found for this criteria."
        });
        res.end();
        return;
      }

      sendProgress({
        type: "progress",
        message: `Analyzing ${snapshots.length} snapshots for '${searchKeyword}'...`,
        currentSnapshot: 0,
        totalSnapshots: snapshots.length
      });

      let foundAny = false;

      // Process each snapshot
      for (let i = 0; i < snapshots.length; i++) {
        // Check if client disconnected
        if (!clientConnected) {
          console.log("[SSE] Aborting scan due to client disconnect");
          return;
        }

        const { timestamp, original } = snapshots[i];
        const archiveUrl = `https://web.archive.org/web/${timestamp}/${original}`;

        sendProgress({
          type: "progress",
          message: `Scanning snapshot: ${timestamp}...`,
          currentSnapshot: i + 1,
          totalSnapshots: snapshots.length
        });

        try {
          // Be polite to the Wayback Machine
          await sleep(Math.random() * 500 + 500);

          const response = await fetch(archiveUrl, {
            headers: HEADERS,
            signal: AbortSignal.timeout(TIMEOUT)
          });

          if (response.ok) {
            const html = await response.text();
            const matches = extractData(html, searchKeyword, timestamp, archiveUrl);

            if (matches.length > 0) {
              foundAny = true;
              
              for (const match of matches) {
                sendProgress({
                  type: "match",
                  match
                });
              }
            }
          }
        } catch (error) {
          // Skip failed snapshots silently
          continue;
        }
      }

      // Send completion message
      if (foundAny) {
        sendProgress({
          type: "complete",
          message: "Scan complete."
        });
      } else {
        sendProgress({
          type: "complete",
          message: "Scan finished. No matches found."
        });
      }

    } catch (error) {
      console.error("[Scan Error]:", error);
      sendProgress({
        type: "error",
        error: error instanceof Error ? error.message : "An unknown error occurred"
      });
    }

    res.end();
  });

  const httpServer = createServer(app);
  return httpServer;
}
