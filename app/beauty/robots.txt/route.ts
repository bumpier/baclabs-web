import { robotsTxt, textResponse } from "@/lib/brand/site";
import { brand, LIVE } from "../site";

// Served at /robots.txt on the brand's host (middleware.ts rewrites it here).
export const revalidate = 300;

export function GET() {
  return textResponse(robotsTxt(brand, LIVE), "text/plain");
}
