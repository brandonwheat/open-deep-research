import { NextRequest } from "next/server";

import {
  researchAgricultureGrants,
  writeGrantReport,
} from "@/lib/deep-research";
import { createModel, type AIModel } from "@/lib/deep-research/ai/providers";

export async function POST(req: NextRequest) {
  try {
    const {
      query,
      farmType,
      location,
      numQueries = 5,
      modelId = "o3-mini",
    } = await req.json();

    // Retrieve API keys from secure cookies
    const openaiKey = req.cookies.get("openai-key")?.value;
    const firecrawlKey = req.cookies.get("firecrawl-key")?.value;

    // Add API key validation
    if (process.env.NEXT_PUBLIC_ENABLE_API_KEYS === "true") {
      if (!openaiKey || !firecrawlKey) {
        return Response.json(
          { error: "API keys are required but not provided" },
          { status: 401 }
        );
      }
    }

    console.log("\n🚜 [GRANT RESEARCH ROUTE] === Request Started ===");
    console.log("Query:", query);
    console.log("Farm Type:", farmType);
    console.log("Location:", location);
    console.log("Model ID:", modelId);
    console.log("Configuration:", {
      numQueries,
    });
    console.log("API Keys Present:", {
      OpenAI: openaiKey ? "✅" : "❌",
      FireCrawl: firecrawlKey ? "✅" : "❌",
    });

    try {
      const model = createModel(modelId as AIModel, openaiKey);
      console.log("\n🤖 [GRANT RESEARCH ROUTE] === Model Created ===");
      console.log("Using Model:", modelId);

      const encoder = new TextEncoder();
      const stream = new TransformStream();
      const writer = stream.writable.getWriter();

      // Progress tracking function
      const onProgress = async (update: string) => {
        try {
          await writer.write(encoder.encode(`data: ${JSON.stringify({ progress: update })}\n\n`));
        } catch (e) {
          console.error("[GRANT RESEARCH ROUTE] Error writing progress:", e);
        }
      };

      // Start the response stream
      const response = new Response(stream.readable, {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
        },
      });

      // Research grants asynchronously
      (async () => {
        try {
          // Initial research phase
          const grantResearchResult = await researchAgricultureGrants({
            query,
            farmType,
            location,
            numQueries,
            onProgress,
            model,
            firecrawlKey,
          });

          // Check if any grants were found
          if (grantResearchResult.grants.length === 0) {
            await onProgress("No grants found. Try refining your search or providing more details about your farm/ranch.");
            await writer.write(
              encoder.encode(`data: ${JSON.stringify({ done: true, report: "No grants found that match your criteria." })}\n\n`)
            );
            await writer.close();
            return;
          }

          // Generate the final report
          await onProgress(`Generating comprehensive report for ${grantResearchResult.grants.length} grants...`);
          
          const finalReport = await writeGrantReport({
            query,
            farmType,
            location,
            grants: grantResearchResult.grants,
            visitedUrls: grantResearchResult.visitedUrls,
            model,
          });

          // Send the final report
          await writer.write(
            encoder.encode(`data: ${JSON.stringify({ done: true, report: finalReport })}\n\n`)
          );
          
          console.log("\n✅ [GRANT RESEARCH ROUTE] === Request Completed ===");
          console.log(`Found ${grantResearchResult.grants.length} grants`);
        } catch (e) {
          console.error("[GRANT RESEARCH ROUTE] Error in research process:", e);
          await writer.write(
            encoder.encode(
              `data: ${JSON.stringify({
                error: `Error in grant research: ${e}`,
              })}\n\n`
            )
          );
        } finally {
          await writer.close();
        }
      })();

      return response;
    } catch (err) {
      console.error("[GRANT RESEARCH ROUTE] Error:", err);
      return Response.json(
        { error: `Error creating model: ${err}` },
        { status: 500 }
      );
    }
  } catch (err) {
    console.error("[GRANT RESEARCH ROUTE] Error:", err);
    return Response.json(
      { error: `Error processing request: ${err}` },
      { status: 400 }
    );
  }
} 