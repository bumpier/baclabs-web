import { llmsTxt, textResponse } from "@/lib/brand/site";
import { brand, DESCRIPTION } from "../site";

// Served at /llms.txt on the brand's host (middleware.ts rewrites it here).
export const revalidate = 300;

export function GET() {
  return textResponse(llmsTxt(brand, DESCRIPTION), "text/plain");
}
