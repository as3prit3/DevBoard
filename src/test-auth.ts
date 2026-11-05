import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_PUBLISHABLE_KEY;

if (!url || !key) {
  throw new Error("Missing Supabase environment variables");
}

const supabase = createClient(url, key);

const email = process.env.TEST_USER_EMAIL as string;
const password = process.env.TEST_USER_PASSWORD as string;

if (!email || !password) {
  throw new Error("Missing test credentials");
}

const { data, error } =
  await supabase.auth.signInWithPassword({
    email,
    password,
  });

if (error || !data.session) {
  throw new Error(`Login failed: ${error?.message ?? "No session"}`);
}

// TESTING DATABASE ACCESS
// const { data: deletedTask, error, status } = await supabase
//   .from("tasks")
//   .delete()
//   .eq("id", "cc8a6bde-d940-4a37-950b-9e6c0201edcd")
//   .select("id, title");

// console.log("HTTP status:", status);
// console.log("Deleted task:", deletedTask);
// console.log("Error:", error);


// // TOKEN VALIDATION
// const { data, error } = await supabase.auth.getUser(
//   login.session.access_token,
// );

// if (error) {
//   throw new Error(`Token validation failed: ${error.message}`);
// }

// console.log("Token validated:", Boolean(data.user));
// console.log("Authenticated user ID:", data.user.id);
// console.log("Email:", data.user.email);

// // LOGIN
// const { data, error } = await supabase.auth.signInWithPassword({
//   email,
//   password,
// });

// if (error) {
//   console.error("Login failed:", error.message);
// } else {
//   console.log("Login successful:", Boolean(data.session));
//   console.log("User ID:", data.user.id);
//   console.log("Access token received:", Boolean(data.session?.access_token));
// }

// // SIGN UP
// const { data, error } = await supabase.auth.signUp({
//   email,
//   password,
// });

// if (error) {
//   console.error("Registration failed:", error.message);
// } else {
//   console.log("User ID:", data.user?.id);
//   console.log("Session created:", Boolean(data.session));
//   console.log("Confirmation required:", Boolean(data.user && !data.session));
// }
