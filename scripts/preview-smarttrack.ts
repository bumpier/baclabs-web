/**
 * Print exactly what would be sent to SmartTrack's generate-label for a
 * sample order, without a warehouse, SKUs, a database or a network call.
 * Nothing is sent. To see how SmartTrack actually reads it, use
 * scripts/check-smarttrack.ts.
 *
 *   npm run preview:smarttrack
 *   npm run preview:smarttrack -- --pack ten --qty 2 --service STNINRM48 \
 *     --instructions "Leave with neighbour at 12"
 *
 * Flags: see scripts/smarttrack-sample.ts.
 */
import { sampleRequest } from "./smarttrack-sample";

const { request, problems, warnings } = sampleRequest("PREVIEW-ORDER-1");
if (!request) {
  console.error("SmartTrack would NOT be called — fix these first:");
  for (const p of problems) console.error(`  ✗ ${p}`);
  process.exit(1);
}
console.log("POST https://www.smarttrack.co/api/v2/generate-label (qa.smarttrack.co on UAT)\n");
console.log(JSON.stringify(request, null, 2));
for (const w of warnings) console.log(`\nnote: ${w}`);
