import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db/connect";
import { PaymentGatewayService } from "@/services/integrations/PaymentGatewayService";

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const headersObj: Record<string, string> = {};

  req.headers.forEach((val, key) => {
    headersObj[key.toLowerCase()] = val;
  });

  const gatewayService = PaymentGatewayService.getInstance();

  if (!gatewayService.isConfigured()) {
    return NextResponse.json(
      {
        success: false,
        status: "NOT_CONFIGURED",
        message:
          "Payment gateway credentials are not configured on server",
      },
      { status: 503 }
    );
  }

  const signature =
    headersObj["x-signature"] ||
    headersObj["x-webhook-signature"] ||
    headersObj["signature"] ||
    "";

  // Verify HMAC signature in constant time
  const isValid = gatewayService.verifySignature(rawBody, signature);
  if (!isValid) {
    return NextResponse.json(
      {
        success: false,
        status: "INVALID_SIGNATURE",
        message: "Webhook signature verification failed",
      },
      { status: 401 }
    );
  }

  try {
    await connectDB();
    const payload = gatewayService.parseWebhook(rawBody, headersObj);
    const result = await gatewayService.processWebhook(payload);

    return NextResponse.json(result, {
      status: result.success ? 200 : 400,
    });
  } catch (err: unknown) {
    const msg =
      err instanceof Error ? err.message : "Payment webhook processing failed";
    return NextResponse.json(
      {
        success: false,
        status: "FAILED",
        message: msg,
      },
      { status: 500 }
    );
  }
}
