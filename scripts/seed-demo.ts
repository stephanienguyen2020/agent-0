/**
 * Phase 12 seed — extend to mint MockUSDC + insert demo tasks via Supabase REST.
 */
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.join(__dirname, "../.env") });

async function main() {
  console.log("Seed demo: wire Supabase service role + contract helpers per docs/07-database-schema.md §9.");
}

main();
