import { NextRequest, NextResponse } from "next/server";
import { scanWebsite } from "@/lib/scanner";
import { generateReport } from "@/lib/report/generate-report";
import { rateLimit, getClientIP } from "@/lib/utils/rate-limit";

// Security: URL validation to prevent SSRF
function isUrlSafe(url: string): boolean {
  try {
    const parsedUrl = new URL(url);

    // Only allow HTTP and HTTPS
    if (!["http:", "https:"].includes(parsedUrl.protocol)) {
      return false;
    }

    // Block private IP ranges and localhost
    const hostname = parsedUrl.hostname.toLowerCase();

    // Block localhost variations
    if (["localhost", "127.0.0.1", "::1"].includes(hostname)) {
      return false;
    }

    // Block private IP ranges (simplified check)
    if (
      hostname.match(/^10\./) ||
      hostname.match(/^192\.168\./) ||
      hostname.match(/^172\.(1[6-9]|2[0-9]|3[0-1])\./) ||
      hostname.match(/^169\.254\./) || // Link-local
      hostname.match(/^0\./) || // This network
      hostname === "0.0.0.0"
    ) {
      return false;
    }

    return true;
  } catch {
    return false;
  }
}

export async function POST(request: NextRequest) {
  // Security: Rate limiting
  const clientIP = getClientIP(request);
  const rateLimitResult = rateLimit(clientIP, {
    maxRequests: 5,
    windowMs: 60000,
  }); // 5 requests per minute

  if (!rateLimitResult.allowed) {
    return NextResponse.json(
      {
        error: "Rate limit exceeded. Please try again later.",
        resetTime: rateLimitResult.resetTime,
      },
      { status: 429 }
    );
  }

  try {
    const { url, options } = await request.json();

    if (!url) {
      return NextResponse.json({ error: "URL is required" }, { status: 400 });
    }

    // Security: Validate URL to prevent SSRF
    if (!isUrlSafe(url)) {
      return NextResponse.json(
        {
          error: "Invalid URL. Only public HTTP/HTTPS URLs are allowed.",
        },
        { status: 400 }
      );
    }

    console.log(`Received scan request for URL: ${url}`);

    // Log scan options including credentials status (without exposing actual password)
    console.log(
      `Scan options: ${JSON.stringify({
        ...options,
        email: options?.email ? `${options.email} (provided)` : "not provided",
        password: options?.password ? "provided" : "not provided",
      })}`
    );

    // Start the scan
    const results = await scanWebsite(url, options);

    // Generate the report
    try {
      const report = generateReport(results);

      // Create a unique report ID for this scan
      const hostname = new URL(url).hostname.replace(/[^a-z0-9]/gi, "_");
      const timestamp = new Date().toISOString().replace(/[^0-9]/g, "");
      const reportId = `${hostname}_${timestamp}`;

      console.log(`Report generated for scan: ${reportId}`);

      return NextResponse.json({
        success: true,
        results,
        reportHtml: report,
        reportId,
        summary: {
          totalPages: results.length,
          totalViolations: results.reduce(
            (sum, page) => sum + page.violations.length,
            0
          ),
          scannedUrl: url,
        },
      });
    } catch (error) {
      console.error(
        `Error generating report: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
      return NextResponse.json({
        success: true,
        results,
        error: "Failed to generate report",
      });
    }
  } catch (error) {
    console.error("Error during scan:", error);
    return NextResponse.json(
      {
        error: "An error occurred during the scan",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
