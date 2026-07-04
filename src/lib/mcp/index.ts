import { auth, defineMcp } from "@lovable.dev/mcp-js";
import listStudents from "./tools/list-students";
import listBuses from "./tools/list-buses";
import listRoutes from "./tools/list-routes";
import recentPayments from "./tools/recent-payments";

const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "tpc-transport-mcp",
  title: "TPC Transport Admin",
  version: "0.1.0",
  instructions:
    "Read-only tools for the Thiagarajar Polytechnic College transport admin app. Use these to look up students, buses, routes, and recent fee payments on behalf of the signed-in staff user.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [listStudents, listBuses, listRoutes, recentPayments],
});
