
import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_PUBLISHABLE_KEY;

if (!url || !key) {
  throw new Error("Missing Supabase environment variables");
}

const supabase = createClient(url, key);

const { data: projects, error, status } = await supabase
  .from("projects")
  .select("id, name, description, created_at");

console.log("HTTP status:", status);
console.log("Projects:", projects);
console.log("Error:", error);
