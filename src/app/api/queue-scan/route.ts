import { NextRequest, NextResponse } from "next/server";
import { queueScanJob, type ScanJob } from "@/lib/queue/aws-sqs";
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
    maxRequests: 10,
    windowMs: 60000,
  }); // 10 requests per minute

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
    const { sessionId, url, reportEmail, options } = await request.json();

    if (!sessionId || !url || !reportEmail) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
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

    console.log(`📤 Queueing scan for ${url} with email ${reportEmail}`);
    console.log(`Session ID: ${sessionId}`);
    console.log(`Options:`, options);

    // Create scan job for AWS SQS
    const scanJob: ScanJob = {
      id: `scan_${Date.now()}`,
      sessionId,
      url,
      reportEmail,
      options,
      status: "queued",
      createdAt: new Date().toISOString(),
    };

    console.log("📋 Scan job created:", scanJob);

    // Add job to AWS SQS queue
    await queueScanJob(scanJob);

    return NextResponse.json({
      success: true,
      jobId: scanJob.id,
      message: "Scan queued successfully",
    });
  } catch (error) {
    console.error("Error queueing scan:", error);
    return NextResponse.json(
      { error: "Failed to queue scan" },
      { status: 500 }
    );
  }
}

// Jobs are now processed by AWS SQS workers
// The background processing happens via the SQS queue system
