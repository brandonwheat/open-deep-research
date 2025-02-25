import FirecrawlApp, { SearchResponse } from '@mendable/firecrawl-js';
import { generateObject } from 'ai';
import { compact } from 'lodash-es';
import { z } from 'zod';

import { createModel, trimPrompt } from './ai/providers';
import { systemPrompt } from './prompt';

type GrantInfo = {
  name: string;
  description: string;
  eligibilityRequirements: string[];
  applicationProcess: string[];
  deadlines: string[];
  fundingAmount: string;
  contactInformation: string;
  applicationUrl: string;
};

type GrantResearchResult = {
  grants: GrantInfo[];
  visitedUrls: string[];
};

// Grant research prompt to override the default system prompt
export const grantResearchPrompt = () => {
  const now = new Date().toISOString();
  return `You are an expert grant researcher specializing in agricultural grants for farms and ranches. Today is ${now}. Follow these instructions when responding:
  - Focus on identifying grants, funding opportunities, and financial assistance programs for agricultural businesses.
  - Pay special attention to eligibility requirements, application deadlines, and submission processes.
  - Be highly detailed when describing grant requirements and application steps.
  - Extract specific dollar amounts, deadlines, and eligibility criteria wherever possible.
  - Always capture the exact URL where users can apply for the grant.
  - When research is complete, organize information in a way that helps farmers and ranchers quickly determine if they qualify.
  - For each grant, provide a template or outline that users can use as a starting point for their application.
  - Verify that sources are official government websites, agricultural organizations, or reputable funding institutions.
  - Prioritize currently available grants over expired opportunities.`;
};

// Helper function to format progress messages consistently
const formatProgress = {
  generating: (count: number, query: string) =>
    `Generating up to ${count} grant-related SERP queries\n${query}`,

  created: (count: number, queries: string) =>
    `Created ${count} grant-related SERP queries\n${queries}`,

  researching: (query: string) => `Researching agricultural grants\n${query}`,

  found: (count: number, query: string) => 
    `Found ${count} potential grant resources\n${query}`,

  ran: (query: string, count: number) =>
    `Ran "${query}"\n${count} content items found`,

  analyzed: (count: number) =>
    `Analyzed ${count} potential grants for eligibility and requirements`,

  generated: (count: number) =>
    `Found ${count} relevant agricultural grants`,
};

// Generate SERP queries specific to grant research
async function generateGrantQueries({
  query,
  farmType,
  location,
  numQueries = 5,
  onProgress,
  model,
}: {
  query: string;
  farmType?: string;
  location?: string;
  numQueries?: number;
  onProgress?: (update: string) => Promise<void>;
  model: ReturnType<typeof createModel>;
}) {
  if (onProgress) {
    await onProgress(formatProgress.generating(numQueries, query));
  }

  const res = await generateObject({
    model,
    system: grantResearchPrompt(),
    prompt: `Generate SERP queries to find agricultural grants and funding opportunities for the following farm/ranch: 
    
    <farm_details>
    ${query}
    ${farmType ? `Farm/Ranch Type: ${farmType}` : ''}
    ${location ? `Location: ${location}` : ''}
    </farm_details>
    
    Return specific search queries that will help find grants this farm or ranch might be eligible for. Focus on:
    1. Federal agricultural grants
    2. State-specific funding programs (if location is provided)
    3. Grants for specific types of farming/ranching operations
    4. Sustainable agriculture grants
    5. Rural development funding
    
    Return a maximum of ${numQueries} queries.`,
    schema: z.object({
      queries: z
        .array(
          z.object({
            query: z.string().describe('The SERP query for finding agricultural grants'),
            targetGoal: z
              .string()
              .describe(
                'What specific type of grants or funding opportunities this query aims to find',
              ),
          }),
        )
        .describe(`List of SERP queries for grant research, max of ${numQueries}`),
    }),
  });

  const queriesList = res.object.queries.map(q => q.query).join(', ');
  if (onProgress) {
    await onProgress(formatProgress.created(res.object.queries.length, queriesList));
  }

  return res.object.queries.slice(0, numQueries).map(q => q.query);
}

// Process SERP results to extract grant information
async function processGrantResults({
  query,
  result,
  onProgress,
  model,
}: {
  query: string;
  result: SearchResponse;
  onProgress?: (update: string) => Promise<void>;
  model: ReturnType<typeof createModel>;
}) {
  const contents = compact(result.data.map(item => item.markdown)).map(
    content => trimPrompt(content, 25_000),
  );

  if (onProgress) {
    await onProgress(formatProgress.ran(query, contents.length));
  }

  if (contents.length === 0) {
    return { grants: [], visitedUrls: [] };
  }

  const res = await generateObject({
    model,
    abortSignal: AbortSignal.timeout(60_000),
    system: grantResearchPrompt(),
    prompt: `Extract information about agricultural grants and funding opportunities from the following search results:
    
    <search_results>
    ${contents.map(content => `<content>\n${content}\n</content>`).join('\n')}
    </search_results>
    
    For each grant or funding opportunity you find, extract the following information:
    1. Name of the grant/program
    2. Brief description
    3. Eligibility requirements
    4. Application process steps
    5. Important deadlines
    6. Funding amount/range
    7. Contact information
    8. Direct URL to apply
    
    Only include grants that are currently available and relevant to farms or ranches. If certain information is not available, indicate that with "Not specified".`,
    schema: z.object({
      grants: z.array(z.object({
        name: z.string().describe('Name of the grant or funding program'),
        description: z.string().describe('Brief description of the grant'),
        eligibilityRequirements: z.array(z.string()).describe('List of eligibility requirements'),
        applicationProcess: z.array(z.string()).describe('Steps in the application process'),
        deadlines: z.array(z.string()).describe('Important deadlines for the grant'),
        fundingAmount: z.string().describe('Amount or range of funding available'),
        contactInformation: z.string().describe('Contact information for questions'),
        applicationUrl: z.string().describe('Direct URL where users can apply for the grant'),
      })),
    }),
  });

  if (onProgress) {
    await onProgress(formatProgress.generated(res.object.grants.length));
  }

  return {
    grants: res.object.grants,
    visitedUrls: result.data
      .map(r => r.url)
      .filter((url): url is string => url != null),
  };
}

// Generate a template for a grant application
export async function generateGrantTemplate({
  grantInfo,
  farmDetails,
  model,
}: {
  grantInfo: GrantInfo;
  farmDetails: string;
  model: ReturnType<typeof createModel>;
}) {
  const res = await generateObject({
    model,
    system: grantResearchPrompt(),
    prompt: `Create a template for a grant application based on the following grant information and farm details:
    
    <grant_information>
    Name: ${grantInfo.name}
    Description: ${grantInfo.description}
    Eligibility Requirements: ${grantInfo.eligibilityRequirements.join('\n')}
    Application Process: ${grantInfo.applicationProcess.join('\n')}
    Deadlines: ${grantInfo.deadlines.join('\n')}
    Funding Amount: ${grantInfo.fundingAmount}
    </grant_information>
    
    <farm_details>
    ${farmDetails}
    </farm_details>
    
    Provide a well-structured template that the farm/ranch owner can use as a starting point for their grant application. Include sections for:
    1. Project Summary/Abstract
    2. Farm/Ranch Background
    3. Project Description
    4. Budget Justification
    5. Expected Outcomes
    6. Timeline
    
    For each section, include sample content based on the farm details provided, but leave appropriate placeholders for specific information the applicant will need to add.`,
    schema: z.object({
      applicationTemplate: z.string().describe('Grant application template in Markdown format'),
      additionalTips: z.array(z.string()).describe('Tips for a successful grant application'),
    }),
  });

  return res.object;
}

// Main function to research agricultural grants
export async function researchAgricultureGrants({
  query,
  farmType,
  location,
  numQueries = 5,
  onProgress,
  model,
  firecrawlKey,
}: {
  query: string;
  farmType?: string;
  location?: string;
  numQueries?: number;
  onProgress?: (update: string) => Promise<void>;
  model: ReturnType<typeof createModel>;
  firecrawlKey?: string;
}): Promise<GrantResearchResult> {
  const firecrawl = new FirecrawlApp({
    apiKey: firecrawlKey ?? process.env.FIRECRAWL_KEY ?? '',
    apiUrl: process.env.FIRECRAWL_BASE_URL,
  });
  
  const results: GrantResearchResult[] = [];
  const allGrants: GrantInfo[] = [];
  const allVisitedUrls: string[] = [];

  // Generate SERP queries specific to grant research
  const serpQueries = await generateGrantQueries({
    query,
    farmType,
    location,
    numQueries,
    onProgress,
    model,
  });

  // Process each SERP query
  for (const serpQuery of serpQueries) {
    try {
      if (onProgress) {
        await onProgress(formatProgress.researching(serpQuery));
      }

      const searchResults = await firecrawl.search(serpQuery, {
        timeout: 15000,
        limit: 5,
        scrapeOptions: { formats: ['markdown'] },
      });

      if (onProgress) {
        await onProgress(formatProgress.found(searchResults.data.length, serpQuery));
      }

      if (searchResults.data.length > 0) {
        const { grants, visitedUrls } = await processGrantResults({
          query: serpQuery,
          result: searchResults,
          onProgress,
          model,
        });

        allGrants.push(...grants);
        allVisitedUrls.push(...visitedUrls);
      }
    } catch (e) {
      console.error(`Error running grant query: ${serpQuery}: `, e);
      if (onProgress) {
        await onProgress(`Error researching grants with "${serpQuery}": ${e}`);
      }
    }
  }

  // Remove duplicate grants based on name
  const uniqueGrants = Array.from(
    new Map(allGrants.map(grant => [grant.name, grant])).values()
  );

  return {
    grants: uniqueGrants,
    visitedUrls: Array.from(new Set(allVisitedUrls)),
  };
}

// Generate a final report with all found grants and application templates
export async function writeGrantReport({
  query,
  farmType,
  location,
  grants,
  visitedUrls,
  model,
}: {
  query: string;
  farmType?: string;
  location?: string;
  grants: GrantInfo[];
  visitedUrls: string[];
  model: ReturnType<typeof createModel>;
}) {
  const farmDetails = `${query}
${farmType ? `Farm/Ranch Type: ${farmType}` : ''}
${location ? `Location: ${location}` : ''}`;

  const grantsString = grants
    .map(
      grant => `
## ${grant.name}

${grant.description}

**Eligibility Requirements:**
${grant.eligibilityRequirements.map(req => `- ${req}`).join('\n')}

**Application Process:**
${grant.applicationProcess.map((step, i) => `${i + 1}. ${step}`).join('\n')}

**Deadlines:**
${grant.deadlines.map(deadline => `- ${deadline}`).join('\n')}

**Funding Amount:** ${grant.fundingAmount}

**Contact Information:** ${grant.contactInformation}

**Application URL:** [Apply Here](${grant.applicationUrl})

---`
    )
    .join('\n');

  // Generate application templates for each grant
  const templates = await Promise.all(
    grants.slice(0, 3).map(async grant => {
      const template = await generateGrantTemplate({
        grantInfo: grant,
        farmDetails,
        model,
      });
      
      return {
        grantName: grant.name,
        template: template.applicationTemplate,
        tips: template.additionalTips,
      };
    })
  );

  const templatesString = templates
    .map(
      template => `
# Application Template for ${template.grantName}

${template.template}

## Application Tips

${template.tips.map(tip => `- ${tip}`).join('\n')}

---`
    )
    .join('\n');

  const res = await generateObject({
    model,
    system: grantResearchPrompt(),
    prompt: `Create a comprehensive grant research report for a farm/ranch based on the following information:
    
    <farm_details>
    ${farmDetails}
    </farm_details>
    
    <grants_found>
    ${grantsString}
    </grants_found>
    
    <application_templates>
    ${templatesString}
    </application_templates>
    
    Create a well-structured report that includes:
    1. An executive summary of available grants
    2. Detailed information about each grant
    3. Eligibility analysis (which grants the farm/ranch likely qualifies for)
    4. Next steps and recommendations
    5. Application templates
    
    Format the report in proper Markdown with clear headings, lists, and sections.`,
    schema: z.object({
      reportMarkdown: z.string().describe('Final grant research report in Markdown'),
    }),
  });

  // Append the visited URLs as a markdown formatted Sources section
  const urlsSection = `\n\n## Sources\n\n${visitedUrls
    .map(url => `- ${url}`)
    .join('\n')}`;

  return `# Agricultural Grant Opportunities Report\n\n${res.object.reportMarkdown}${urlsSection}`;
} 