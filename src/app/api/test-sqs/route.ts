import { NextResponse } from "next/server";
import { SQSClient, ListQueuesCommand } from "@aws-sdk/client-sqs";

export async function GET() {
  try {
    console.log("🔍 Testing AWS SQS connection...");

    // Check environment variables
    const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
    const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
    const region = process.env.AWS_REGION;
    const queueUrl = process.env.AWS_SQS_QUEUE_URL;

    console.log("Environment check:");
    console.log("- AWS_ACCESS_KEY_ID:", accessKeyId ? "✅ Set" : "❌ Missing");
    console.log(
      "- AWS_SECRET_ACCESS_KEY:",
      secretAccessKey ? "✅ Set" : "❌ Missing"
    );
    console.log("- AWS_REGION:", region || "❌ Missing");
    console.log("- AWS_SQS_QUEUE_URL:", queueUrl || "❌ Missing");

    if (!accessKeyId || !secretAccessKey || !region || !queueUrl) {
      return NextResponse.json(
        {
          error: "Missing AWS environment variables",
          details: {
            accessKeyId: !!accessKeyId,
            secretAccessKey: !!secretAccessKey,
            region: !!region,
            queueUrl: !!queueUrl,
          },
        },
        { status: 400 }
      );
    }

    // Initialize SQS client
    const sqsClient = new SQSClient({
      region,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    });

    // Test SQS permissions by listing queues
    const command = new ListQueuesCommand({});
    const result = await sqsClient.send(command);

    console.log("✅ SQS connection successful!");
    console.log("Available queues:", result.QueueUrls);

    return NextResponse.json({
      success: true,
      message: "AWS SQS connection successful",
      availableQueues: result.QueueUrls || [],
      region,
      targetQueue: queueUrl,
    });
  } catch (error: any) {
    console.error("❌ SQS connection failed:", error);

    return NextResponse.json(
      {
        error: "SQS connection failed",
        details: error.message,
        troubleshooting: [
          "Verify AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY are correct",
          "Check if AWS credentials have SQS permissions",
          "Confirm AWS_REGION matches your queue region",
          "Verify AWS_SQS_QUEUE_URL is correct",
        ],
      },
      { status: 500 }
    );
  }
}
