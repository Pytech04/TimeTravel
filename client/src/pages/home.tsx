import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { scanRequestSchema, type ScanRequest, type ScanMatch, useCases } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Badge } from "@/components/ui/badge";
import { Loader2, Download, ExternalLink, Terminal, Search, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function Home() {
  const [isScanning, setIsScanning] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0, message: "" });
  const [matches, setMatches] = useState<ScanMatch[]>([]);
  const [scanComplete, setScanComplete] = useState(false);
  const [lastScanParams, setLastScanParams] = useState<ScanRequest | null>(null);
  const { toast } = useToast();

  const form = useForm<ScanRequest>({
    resolver: zodResolver(scanRequestSchema),
    defaultValues: {
      domain: "",
      year: "",
      keyword: "",
      limit: 100,
    },
  });

  const onSubmit = async (data: ScanRequest) => {
    setIsScanning(true);
    setMatches([]);
    setScanComplete(false);
    setProgress({ current: 0, total: 0, message: "Starting scan..." });
    setLastScanParams(data);

    try {
      const params = new URLSearchParams({
        domain: data.domain,
        keyword: data.keyword,
        limit: data.limit.toString(),
        ...(data.year && { year: data.year }),
      });

      const eventSource = new EventSource(`/api/scan?${params}`);

      eventSource.onmessage = (event) => {
        const progressData = JSON.parse(event.data);

        if (progressData.type === "progress") {
          setProgress({
            current: progressData.currentSnapshot || 0,
            total: progressData.totalSnapshots || 0,
            message: progressData.message || "",
          });
        } else if (progressData.type === "match") {
          setMatches((prev) => [...prev, progressData.match]);
        } else if (progressData.type === "complete") {
          setScanComplete(true);
          setIsScanning(false);
          eventSource.close();
          
          if (matches.length === 0 && progressData.message) {
            toast({
              title: "Scan Complete",
              description: progressData.message,
            });
          }
        } else if (progressData.type === "error") {
          toast({
            variant: "destructive",
            title: "Scan Error",
            description: progressData.error || "An error occurred during scanning",
          });
          setIsScanning(false);
          eventSource.close();
        }
      };

      eventSource.onerror = () => {
        toast({
          variant: "destructive",
          title: "Connection Error",
          description: "Lost connection to server. Please try again.",
        });
        setIsScanning(false);
        eventSource.close();
      };
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to start scan. Please try again.",
      });
      setIsScanning(false);
    }
  };

  const downloadReport = () => {
    if (!lastScanParams) return;

    const reportLines = [
      `WAYBACK FORENSIC SCAN REPORT`,
      `============================`,
      ``,
      `Target Domain: ${lastScanParams.domain}`,
      `Search Keyword: ${lastScanParams.keyword}`,
      ...(lastScanParams.year ? [`Year Filter: ${lastScanParams.year}`] : []),
      `Scan Date: ${new Date().toISOString()}`,
      `Total Matches: ${matches.length}`,
      ``,
      `FINDINGS`,
      `========`,
      ``,
    ];

    matches.forEach((match, index) => {
      reportLines.push(`[${index + 1}] MATCH FOUND in Snapshot ${match.timestamp}`);
      reportLines.push(`    URL: ${match.archiveUrl}`);
      reportLines.push(`    Type: Found in ${match.matchType}`);
      reportLines.push(`    Snippet: ${match.snippet}`);
      reportLines.push(``);
    });

    if (matches.length === 0) {
      reportLines.push(`No matches found.`);
    }

    const blob = new Blob([reportLines.join('\n')], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `forensic_report_${lastScanParams.domain}_${Date.now()}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-4xl px-6 py-8">
        {/* Header */}
        <header className="mb-8 border-b border-border pb-6">
          <div className="flex items-center gap-3 mb-2">
            <Terminal className="h-8 w-8 text-primary" />
            <h1 className="font-mono text-2xl font-bold text-foreground">
              WAYBACK FORENSIC SCRAPER
            </h1>
          </div>
          <p className="text-sm text-muted-foreground font-mono">
            CTF & Security Research Tool
          </p>
        </header>

        {/* Main Form Card */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="font-mono text-lg">Scan Configuration</CardTitle>
            <CardDescription className="font-mono text-xs">
              Search archived snapshots for keywords, secrets, or forensic evidence
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="domain"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="font-mono text-sm">Target Domain</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          placeholder="example.com"
                          className="font-mono text-sm"
                          disabled={isScanning}
                          data-testid="input-domain"
                        />
                      </FormControl>
                      <FormMessage className="font-mono text-xs" />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="year"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="font-mono text-sm">
                        Year Filter (Optional)
                      </FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          placeholder="2022"
                          className="font-mono text-sm"
                          disabled={isScanning}
                          data-testid="input-year"
                        />
                      </FormControl>
                      <FormMessage className="font-mono text-xs" />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="keyword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="font-mono text-sm">Search Keyword</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          placeholder="ctf{, password, API_KEY"
                          className="font-mono text-sm"
                          disabled={isScanning}
                          data-testid="input-keyword"
                        />
                      </FormControl>
                      <FormMessage className="font-mono text-xs" />
                    </FormItem>
                  )}
                />

                <Button
                  type="submit"
                  className="w-full font-mono"
                  disabled={isScanning}
                  data-testid="button-start-scan"
                >
                  {isScanning ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Scanning...
                    </>
                  ) : (
                    <>
                      <Search className="mr-2 h-4 w-4" />
                      Start Forensic Scan
                    </>
                  )}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>

        {/* Use Case Reference Table */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="font-mono text-lg">Use Case Reference</CardTitle>
            <CardDescription className="font-mono text-xs">
              Common search patterns for security research
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {useCases.map((useCase) => (
                <div
                  key={useCase.category}
                  className="border border-border rounded-md p-3"
                  data-testid={`usecase-${useCase.category.toLowerCase().replace(/\s+/g, '-')}`}
                >
                  <div className="flex items-start gap-3">
                    <Badge variant="secondary" className="font-mono text-xs shrink-0">
                      {useCase.category}
                    </Badge>
                    <div className="flex-1 min-w-0">
                      <p className="font-mono text-xs text-primary mb-1 break-words">
                        {useCase.keywords}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {useCase.description}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Progress Section */}
        {isScanning && (
          <Card className="mb-6" data-testid="progress-section">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3 mb-3">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
                <span className="font-mono text-sm text-foreground">
                  {progress.message}
                </span>
              </div>
              {progress.total > 0 && (
                <p className="font-mono text-xs text-muted-foreground" data-testid="text-progress">
                  Analyzing {progress.current}/{progress.total} snapshots
                </p>
              )}
            </CardContent>
          </Card>
        )}

        {/* Results Display */}
        {matches.length > 0 && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="font-mono text-lg font-semibold text-foreground">
                Scan Results ({matches.length} {matches.length === 1 ? 'match' : 'matches'})
              </h2>
              <Button
                onClick={downloadReport}
                variant="secondary"
                size="sm"
                className="font-mono"
                data-testid="button-download-report"
              >
                <Download className="mr-2 h-4 w-4" />
                Download Report
              </Button>
            </div>

            <div className="space-y-4">
              {matches.map((match, index) => (
                <Card key={index} data-testid={`match-card-${index}`}>
                  <CardContent className="pt-6">
                    <div className="space-y-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline" className="font-mono text-xs">
                          {match.timestamp}
                        </Badge>
                        <Badge
                          variant={
                            match.matchType === "TEXT"
                              ? "default"
                              : match.matchType === "JS"
                              ? "secondary"
                              : "outline"
                          }
                          className="font-mono text-xs"
                        >
                          Found in {match.matchType}
                        </Badge>
                      </div>

                      <a
                        href={match.archiveUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 text-xs text-primary hover:text-primary/80 transition-colors font-mono break-all"
                        data-testid={`link-archive-${index}`}
                      >
                        <ExternalLink className="h-3 w-3 shrink-0" />
                        {match.archiveUrl}
                      </a>

                      <div className="bg-muted border border-border rounded-md p-3">
                        <p className="font-mono text-xs text-foreground break-words whitespace-pre-wrap">
                          {match.snippet}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* No Results Message */}
        {scanComplete && matches.length === 0 && (
          <Card data-testid="no-results">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3 text-muted-foreground">
                <AlertCircle className="h-5 w-5" />
                <p className="font-mono text-sm">
                  Scan complete. No matches found for the specified criteria.
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Footer */}
        <footer className="mt-12 pt-6 border-t border-border">
          <p className="text-xs text-muted-foreground text-center">
            Wayback Machine forensic scanner for security research and CTF challenges.
          </p>
          <p className="text-xs text-muted-foreground text-center mt-1">
            Data sourced from the Internet Archive's Wayback Machine CDX API.
          </p>
        </footer>
      </div>
    </div>
  );
}
