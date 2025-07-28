import { NextResponse } from "next/server";
import http from "http";
import os from "os";

// Function to get public IP address
async function getPublicIpAddress(): Promise<string> {
  return new Promise((resolve, reject) => {
    // Try to get public IP using a public API
    http
      .get("http://api.ipify.org", (res) => {
        let data = "";
        res.on("data", (chunk) => {
          data += chunk;
        });
        res.on("end", () => {
          resolve(data.trim());
        });
      })
      .on("error", (err) => {
        console.warn(`Error getting public IP: ${err.message}`);

        // Fallback: use local network interfaces
        try {
          const interfaces = os.networkInterfaces();
          // Find the first non-internal IPv4 address
          for (const [, networkInterface] of Object.entries(interfaces)) {
            if (networkInterface) {
              for (const iface of networkInterface) {
                if (iface.family === "IPv4" && !iface.internal) {
                  resolve(iface.address);
                  return;
                }
              }
            }
          }
          // If no suitable address is found, return localhost
          resolve("127.0.0.1");
        } catch (error) {
          reject(error);
        }
      });
  });
}

export async function GET() {
  try {
    const ipAddress = await getPublicIpAddress();
    return NextResponse.json({ ip: ipAddress });
  } catch (error) {
    console.error("Error getting IP address:", error);
    return NextResponse.json(
      {
        error: "Failed to get IP address",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
