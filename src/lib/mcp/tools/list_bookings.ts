import { createClient } from "@supabase/supabase-js";
import { defineTool, type ToolContext } from "@lovable.dev/mcp-js";
import { z } from "zod";

function supabaseForUser(ctx: ToolContext) {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
    global: { headers: { Authorization: `Bearer ${ctx.getToken()}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export default defineTool({
  name: "list_bookings",
  title: "List bookings",
  description:
    "List recent booking requests for the chalet, optionally filtered by check-in date range or status. Admin access required.",
  inputSchema: {
    from: z.string().optional().describe("Filter: check-in on or after this date (YYYY-MM-DD)."),
    to: z.string().optional().describe("Filter: check-in on or before this date (YYYY-MM-DD)."),
    status: z.string().optional().describe("Filter by status, e.g. pending_payment, confirmed, fully_paid, cancelled."),
    limit: z.number().int().min(1).max(200).optional().describe("Max rows to return (default 50)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ from, to, status, limit }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const sb = supabaseForUser(ctx);
    const { data: allowed } = await sb.rpc("has_role", {
      _user_id: ctx.getUserId(),
      _role: "admin",
    });
    if (!allowed) {
      return { content: [{ type: "text", text: "Admin access required" }], isError: true };
    }
    let q = sb
      .from("booking_requests")
      .select(
        "id, booking_group_id, guest_name, email, phone, check_in, check_out, room_type, status, total_amount, deposit_amount, balance_amount, payment_reference, created_at",
      )
      .order("check_in", { ascending: false })
      .limit(limit ?? 50);
    if (from) q = q.gte("check_in", from);
    if (to) q = q.lte("check_in", to);
    if (status) q = q.eq("status", status);
    const { data, error } = await q;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
      structuredContent: { bookings: data ?? [] },
    };
  },
});