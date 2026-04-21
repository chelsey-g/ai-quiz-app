"use client";

import { useCallback, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

interface ImportResult {
  file: string;
  status: "ok" | "error";
  title?: string;
  cardCount?: number;
  provider?: string;
  model?: string;
  error?: string;
}

type ImportState = "idle" | "processing" | "done";

export default function ImportPage() {
  const [state, setState] = useState<ImportState>("idle");
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<ImportResult[]>([]);
  const [isDragging, setIsDragging] = useState(false);

  const processFiles = useCallback(async (files: File[]) => {
    const mdFiles = files.filter((f) => f.name.endsWith(".md"));
    if (mdFiles.length === 0) return;

    setState("processing");
    setProgress(0);
    setResults([]);

    const fileData = await Promise.all(
      mdFiles.map(async (f) => ({ name: f.name, content: await f.text() }))
    );

    // Send in batches of 5 to avoid timeouts
    const batchSize = 5;
    const allResults: ImportResult[] = [];

    for (let i = 0; i < fileData.length; i += batchSize) {
      const batch = fileData.slice(i, i + batchSize);
      const res = await fetch("/api/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ files: batch }),
      });
      const data = await res.json();
      allResults.push(...data.results);
      setProgress(Math.round(((i + batch.length) / fileData.length) * 100));
      setResults([...allResults]);
    }

    setState("done");
  }, []);

  const onFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    processFiles(files);
  };

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const files = Array.from(e.dataTransfer.files);
      processFiles(files);
    },
    [processFiles]
  );

  const succeeded = results.filter((r) => r.status === "ok");
  const failed = results.filter((r) => r.status === "error");
  const totalCards = succeeded.reduce((sum, r) => sum + (r.cardCount ?? 0), 0);

  return (
    <main className="min-h-screen bg-background p-8 max-w-3xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight">Import Notes</h1>
        <p className="text-muted-foreground mt-1">
          Upload your Markdown files to generate study decks.
        </p>
      </div>

      {state === "idle" && (
        <div
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={onDrop}
          className={`border-2 border-dashed rounded-xl p-16 text-center transition-colors ${
            isDragging
              ? "border-primary bg-primary/5"
              : "border-border hover:border-primary/50"
          }`}
        >
          <p className="text-muted-foreground mb-4">
            Drag and drop <span className="font-medium text-foreground">.md files</span> here
          </p>
          <label className="cursor-pointer">
            <Button variant="outline" onClick={(e) => e.currentTarget.closest("label")?.querySelector("input")?.click()}>
              Browse files
            </Button>
            <input
              type="file"
              accept=".md"
              multiple
              className="hidden"
              onChange={onFileInput}
            />
          </label>
        </div>
      )}

      {state === "processing" && (
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground mb-3">
              Generating decks… {progress}%
            </p>
            <Progress value={progress} />
            {results.length > 0 && (
              <p className="text-sm text-muted-foreground mt-3">
                {results.length} file{results.length !== 1 ? "s" : ""} processed so far
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {results.length > 0 && (
        <div className="mt-6 space-y-3">
          {state === "done" && (
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm text-muted-foreground">
                {succeeded.length} deck{succeeded.length !== 1 ? "s" : ""} created ·{" "}
                {totalCards} cards total
                {failed.length > 0 && ` · ${failed.length} failed`}
              </p>
              <Button variant="outline" size="sm" onClick={() => { setState("idle"); setResults([]); }}>
                Import more
              </Button>
            </div>
          )}

          {results.map((result) => (
            <Card key={result.file} className={result.status === "error" ? "border-destructive/50" : ""}>
              <CardHeader className="pb-2 pt-4 px-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <CardTitle className="text-sm font-medium">
                      {result.title ?? result.file}
                    </CardTitle>
                    <p className="text-xs text-muted-foreground mt-0.5">{result.file}</p>
                  </div>
                  <Badge variant={result.status === "ok" ? "default" : "destructive"}>
                    {result.status === "ok" ? `${result.cardCount} cards` : "failed"}
                  </Badge>
                </div>
              </CardHeader>
              {result.status === "ok" && result.model && (
                <CardContent className="px-4 pb-3">
                  <p className="text-xs text-muted-foreground">
                    via {result.provider}/{result.model}
                  </p>
                </CardContent>
              )}
              {result.status === "error" && (
                <CardContent className="px-4 pb-3">
                  <p className="text-xs text-destructive">{result.error}</p>
                </CardContent>
              )}
            </Card>
          ))}
        </div>
      )}
    </main>
  );
}
