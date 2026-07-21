import { auth, defineMcp } from "@lovable.dev/mcp-js";
import listBookings from "./tools/list_bookings";
import listCabins from "./tools/list_cabins";

const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "rajawali-dcabin-mcp",
  title: "Rajawali D'Cabin",
  version: "0.1.0",
  instructions:
    "Tools for managing Rajawali D'Cabin Chalet: list bookings and cabins. Admin sign-in required.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [listBookings, listCabins],
});