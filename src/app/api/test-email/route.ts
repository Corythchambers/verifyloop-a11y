import { NextRequest, NextResponse } from "next/server";
import { sendReportEmail } from "@/lib/email/aws-ses";

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json();

    if (!email) {
      return NextResponse.json(
        { error: "Email address is required" },
        { status: 400 }
      );
    }

    console.log(`🧪 Testing email send to: ${email}`);

    // Create mock scan results for testing
    const mockScanResults = {
      success: true,
      results: [
        { url: "https://example.com", violations: 2 },
        { url: "https://example.com/about", violations: 1 },
        { url: "https://example.com/contact", violations: 0 },
      ],
      summary: {
        totalViolations: 3,
        pagesScanned: 3,
        issueTypes: ["missing-alt-text", "color-contrast"],
      },
      reportHtml:
        "<html><body><h1>Test Report</h1><p>This is a test accessibility report.</p></body></html>",
    };

    // Send test email using AWS SES
    await sendReportEmail(email, "https://example.com", mockScanResults);

    return NextResponse.json({
      success: true,
      message: `Test email sent successfully to ${email}`,
      note: "Check your inbox and spam folder",
    });
  } catch (error) {
    console.error("❌ Test email failed:", error);

    return NextResponse.json(
      {
        error: "Failed to send test email",
        details: error instanceof Error ? error.message : "Unknown error",
        troubleshooting: {
          checkList: [
            "Verify AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY are set",
            "Confirm AWS_SES_FROM_EMAIL is verified in SES console",
            "Check if SES is in sandbox mode (can only send to verified emails)",
            "Verify AWS_REGION matches your SES region",
            "Check IAM permissions for SES actions",
          ],
        },
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    message: "AWS SES Test Email Endpoint",
    usage: 'POST with {"email": "test@example.com"}',
    note: "Use this to test your AWS SES configuration",
  });
}
