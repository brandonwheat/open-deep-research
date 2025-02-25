"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import ReactMarkdown from "react-markdown";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";

export default function GrantsPage() {
  const { toast } = useToast();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [progress, setProgress] = useState<string>("");
  const [report, setReport] = useState<string | null>(null);
  const [queryData, setQueryData] = useState<{
    query: string;
    farmType?: string;
    location?: string;
    timestamp: string;
  } | null>(null);

  useEffect(() => {
    // Load query data from localStorage
    const storedQuery = localStorage.getItem("grantResearchQuery");
    if (!storedQuery) {
      router.push("/");
      return;
    }

    const parsedQuery = JSON.parse(storedQuery);
    setQueryData(parsedQuery);

    // Run the grant research
    runGrantResearch(parsedQuery);
  }, [router]);

  const runGrantResearch = async (queryData: any) => {
    setIsLoading(true);
    setProgress("Starting grant research...");

    try {
      const response = await fetch("/api/research/grants", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          query: queryData.query,
          farmType: queryData.farmType,
          location: queryData.location,
          numQueries: 5,
        }),
      });

      if (!response.ok) {
        throw new Error("Network response was not ok");
      }

      if (response.body) {
        const reader = response.body.getReader();
        const decoder = new TextDecoder();

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk
            .split("\n\n")
            .filter((line) => line.trim() !== "")
            .map((line) => line.replace("data: ", ""));

          for (const line of lines) {
            try {
              const data = JSON.parse(line);

              if (data.progress) {
                setProgress(data.progress);
              }

              if (data.done && data.report) {
                setReport(data.report);
                setIsLoading(false);
              }

              if (data.error) {
                toast({
                  title: "Error",
                  description: data.error,
                  variant: "destructive",
                });
                setIsLoading(false);
              }
            } catch (e) {
              console.error("Error parsing JSON:", e, line);
            }
          }
        }
      }
    } catch (error) {
      console.error("Error during grant research:", error);
      toast({
        title: "Error",
        description: "Something went wrong during the grant research. Please try again.",
        variant: "destructive",
      });
      setIsLoading(false);
    }
  };

  return (
    <div className="container py-8">
      <div className="mb-6">
        <Button variant="outline" asChild>
          <Link href="/">
            <ChevronLeft className="h-4 w-4 mr-2" />
            Back to Home
          </Link>
        </Button>
      </div>

      <h1 className="text-3xl font-bold mb-6">Agricultural Grant Research</h1>

      {queryData && (
        <Card className="mb-6">
          <CardContent className="pt-6">
            <h2 className="text-xl font-semibold mb-2">Research Query</h2>
            <p className="font-medium">Farm/Ranch Description:</p>
            <p className="mb-2">{queryData.query}</p>
            
            {queryData.farmType && (
              <>
                <p className="font-medium">Farm/Ranch Type:</p>
                <p className="mb-2">{queryData.farmType}</p>
              </>
            )}
            
            {queryData.location && (
              <>
                <p className="font-medium">Location:</p>
                <p className="mb-2">{queryData.location}</p>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <Card>
          <CardContent className="pt-6">
            <h2 className="text-xl font-semibold mb-2">Researching Agricultural Grants</h2>
            <div className="relative">
              <div className="w-full bg-secondary h-2 rounded-full overflow-hidden">
                <div className="h-full bg-primary animate-pulse"></div>
              </div>
            </div>
            <p className="mt-4 text-center text-muted-foreground">{progress}</p>
          </CardContent>
        </Card>
      ) : report ? (
        <div className="prose prose-sm md:prose-base lg:prose-lg dark:prose-invert max-w-none">
          <ReactMarkdown>{report}</ReactMarkdown>
        </div>
      ) : (
        <Card>
          <CardContent className="pt-6">
            <h2 className="text-xl font-semibold mb-2">No Results</h2>
            <p>No grants were found. Try refining your search with more specific details about your farm or ranch.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
} 