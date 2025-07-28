import { NextRequest, NextResponse } from "next/server";
import {
  receiveJobs,
  deleteJob,
  processScanJob,
  type ScanJob,
} from "@/lib/queue/aws-sqs";

// Security: Simple authentication for worker endpoint
function isAuthorized(request: NextRequest): boolean {
  const workerSecret = process.env.WORKER_SECRET;
  if (!workerSecret) {
    // If no secret is set, allow access (for backward compatibility)
    return true;
  }

  const authHeader = request.headers.get("authorization");
  const urlSecret = request.nextUrl.searchParams.get("secret");

  return authHeader === `Bearer ${workerSecret}` || urlSecret === workerSecret;
}

export async function GET(request: NextRequest) {
  // Security: Check authorization
  if (!isAuthorized(request)) {
    return NextResponse.json(
      { error: "Unauthorized. Valid secret required." },
      { status: 401 }
    );
  }

  try {
    console.log("🔄 Checking for jobs in SQS queue...");

    // Receive up to 10 jobs from the queue
    const messages = await receiveJobs(10);

    if (messages.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No jobs in queue",
        processedJobs: 0,
      });
    }

    console.log(`📥 Found ${messages.length} jobs to process`);

    const results = [];

    // Process each job
    for (const message of messages) {
      try {
        const scanJob: ScanJob = JSON.parse(message.Body!);

        console.log(`🔄 Processing job ${scanJob.id} for ${scanJob.url}`);

        // Process the scan job
        await processScanJob(scanJob);

        // Delete the job from queue after successful processing
        await deleteJob(message.ReceiptHandle!);

        results.push({
          jobId: scanJob.id,
          url: scanJob.url,
          status: "completed",
        });

        console.log(`✅ Completed job ${scanJob.id}`);
      } catch (error) {
        console.error("❌ Error processing job:", error);

        results.push({
          jobId: "unknown",
          status: "failed",
          error: error instanceof Error ? error.message : "Unknown error",
        });

        // Don't delete the message - it will be retried
      }
    }

    const successCount = results.filter((r) => r.status === "completed").length;
    const failCount = results.filter((r) => r.status === "failed").length;

    return NextResponse.json({
      success: true,
      message: `Processed ${messages.length} jobs`,
      processedJobs: messages.length,
      successful: successCount,
      failed: failCount,
      results,
    });
  } catch (error) {
    console.error("❌ Worker error:", error);
    return NextResponse.json(
      {
        error: "Worker failed",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  // Security: Check authorization
  if (!isAuthorized(request)) {
    return NextResponse.json(
      { error: "Unauthorized. Valid secret required." },
      { status: 401 }
    );
  }

  try {
    // Make request body optional
    let maxJobs = 1;
    let timeout = 30000;

    try {
      const body = await request.json();
      maxJobs = body.maxJobs || 1;
      timeout = body.timeout || 30000;
    } catch {
      // No JSON body provided, use defaults
    }

    console.log(
      `🚀 Starting worker to process up to ${maxJobs} jobs with ${timeout}ms timeout`
    );

    const startTime = Date.now();
    let totalProcessed = 0;
    const results = [];

    while (totalProcessed < maxJobs && Date.now() - startTime < timeout) {
      const messages = await receiveJobs(1);

      if (messages.length === 0) {
        console.log("📭 No more jobs in queue");
        break;
      }

      for (const message of messages) {
        try {
          const scanJob: ScanJob = JSON.parse(message.Body!);

          console.log(`🔄 Processing job ${scanJob.id} for ${scanJob.url}`);

          await processScanJob(scanJob);
          await deleteJob(message.ReceiptHandle!);

          results.push({
            jobId: scanJob.id,
            url: scanJob.url,
            email: scanJob.reportEmail,
            status: "completed",
          });

          totalProcessed++;
          console.log(
            `✅ Completed job ${scanJob.id} (${totalProcessed}/${maxJobs})`
          );
        } catch (error) {
          console.error("❌ Error processing job:", error);

          results.push({
            status: "failed",
            error: error instanceof Error ? error.message : "Unknown error",
          });

          totalProcessed++;
        }

        if (totalProcessed >= maxJobs) break;
      }
    }

    return NextResponse.json({
      success: true,
      message: `Worker completed`,
      processedJobs: totalProcessed,
      timeElapsed: Date.now() - startTime,
      results,
    });
  } catch (error) {
    console.error("❌ Worker error:", error);
    return NextResponse.json(
      {
        error: "Worker failed",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
