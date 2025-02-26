"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, ExternalLink } from "lucide-react";
import ReactMarkdown from "react-markdown";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";

type Grant = {
  name: string;
  description: string;
  eligibilityRequirements: string[];
  applicationProcessSteps: string[];
  deadlines: string[];
  fundingAmount: string;
  contactInformation: string;
  applicationUrl: string;
  relevanceScore: number;
  keyTakeaways: string[];
};

type StructuredReport = {
  executiveSummary: string;
  grantOpportunities: Grant[];
  eligibilityAnalysis: string;
  nextSteps: {
    step: string;
    priority: 'High' | 'Medium' | 'Low';
    explanation: string;
  }[];
  sources: string[];
};

export default function GrantsPage() {
  const { toast } = useToast();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [progress, setProgress] = useState<string>("");
  const [report, setReport] = useState<StructuredReport | null>(null);
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
        <div className="space-y-8">
          {/* Executive Summary Section */}
          <Card>
            <CardHeader>
              <CardTitle>Executive Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="prose prose-sm dark:prose-invert max-w-none">
                <ReactMarkdown>{report.executiveSummary}</ReactMarkdown>
              </div>
            </CardContent>
          </Card>
          
          {/* Grants Section */}
          <div>
            <h2 className="text-2xl font-bold mb-4">Available Grants</h2>
            <div className="grid gap-6 md:grid-cols-2">
              {report.grantOpportunities.map((grant, index) => (
                <Card key={index} className="h-full flex flex-col">
                  <CardHeader>
                    <CardTitle>{grant.name}</CardTitle>
                    <CardDescription>
                      {grant.fundingAmount !== "Not specified" ? `Funding: ${grant.fundingAmount}` : ""}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="flex-grow">
                    <p className="mb-4">{grant.description}</p>
                    
                    {grant.eligibilityRequirements.length > 0 && (
                      <div className="mb-4">
                        <h4 className="font-semibold mb-1">Eligibility Requirements:</h4>
                        <ul className="list-disc pl-5 space-y-1">
                          {grant.eligibilityRequirements.map((req, i) => (
                            <li key={i}>{req}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    
                    {grant.deadlines.length > 0 && (
                      <div className="mb-4">
                        <h4 className="font-semibold mb-1">Deadlines:</h4>
                        <ul className="list-disc pl-5 space-y-1">
                          {grant.deadlines.map((deadline, i) => (
                            <li key={i}>{deadline}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    
                    {grant.contactInformation !== "Not specified" && (
                      <div className="mb-4">
                        <h4 className="font-semibold mb-1">Contact:</h4>
                        <p>{grant.contactInformation}</p>
                      </div>
                    )}
                    
                    {grant.keyTakeaways.length > 0 && (
                      <div className="mb-4">
                        <h4 className="font-semibold mb-1">Key Takeaways:</h4>
                        <ul className="list-disc pl-5 space-y-1">
                          {grant.keyTakeaways.map((takeaway, i) => (
                            <li key={i}>{takeaway}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </CardContent>
                  <CardFooter className="flex justify-between items-center border-t pt-4">
                    <div>
                      <h4 className="font-semibold text-sm">{grant.applicationProcessSteps.length} application steps</h4>
                    </div>
                    <Button asChild>
                      <a href={grant.applicationUrl} target="_blank" rel="noopener noreferrer">
                        Apply <ExternalLink className="ml-2 h-4 w-4" />
                      </a>
                    </Button>
                  </CardFooter>
                </Card>
              ))}
            </div>
          </div>
          
          {/* Eligibility Analysis */}
          <Card>
            <CardHeader>
              <CardTitle>Eligibility Analysis</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="prose prose-sm dark:prose-invert max-w-none">
                <ReactMarkdown>{report.eligibilityAnalysis}</ReactMarkdown>
              </div>
            </CardContent>
          </Card>
          
          {/* Next Steps */}
          <Card>
            <CardHeader>
              <CardTitle>Next Steps & Recommendations</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {report.nextSteps.map((step, index) => (
                  <div key={index} className="flex items-start gap-3">
                    <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full text-white ${
                      step.priority === 'High' ? 'bg-red-500' : 
                      step.priority === 'Medium' ? 'bg-amber-500' : 'bg-blue-500'
                    }`}>
                      {index + 1}
                    </span>
                    <div>
                      <p className="font-medium">{step.step}</p>
                      <p className="text-sm text-muted-foreground">{step.explanation}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
          
          {/* Sources */}
          <Card>
            <CardHeader>
              <CardTitle>Sources</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="list-disc pl-5 space-y-1">
                {report.sources.map((source, index) => (
                  <li key={index}>
                    <a 
                      href={source}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-500 hover:underline"
                    >
                      {source}
                    </a>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
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