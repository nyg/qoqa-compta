/**
 * GET /api/orders/[orderNumber]/pdf
 *
 * Streams the invoice PDF stored in qoqa_orders.pdf_data for the given order.
 * Returns 404 when the order doesn't exist or has no PDF blob.
 *
 * The Content-Disposition is "inline" so browsers render the file in their
 * native PDF viewer (usable inside an <iframe>), and a long private
 * Cache-Control is applied because PDFs never change once stored.
 */
import { NextRequest, NextResponse } from "next/server";
import { fetchOrderPdf } from "@/lib/queries";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ orderNumber: string }> }
) {
  const { orderNumber } = await params;

  if (!orderNumber) {
    return NextResponse.json({ error: "Missing orderNumber." }, { status: 400 });
  }

  try {
    const pdf = await fetchOrderPdf(orderNumber);
    if (!pdf) {
      return NextResponse.json(
        { error: "PDF not found for this order." },
        { status: 404 }
      );
    }

    // Quote the filename to be safe for header value (drop quotes from name).
    const safeName = pdf.filename.replace(/["\r\n]/g, "");
    return new Response(new Uint8Array(pdf.bytes), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${safeName}"`,
        "Content-Length": String(pdf.bytes.byteLength),
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch (error) {
    console.error("[/api/orders/:n/pdf] DB error:", error);
    return NextResponse.json(
      { error: "Failed to fetch PDF from the database." },
      { status: 500 }
    );
  }
}
