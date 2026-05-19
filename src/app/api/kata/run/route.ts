// src/app/api/kata/run/route.ts
import { NextRequest } from "next/server";
import { Sandbox } from "@vercel/sandbox";
import { createClient } from "@/lib/supabase/server";
import type { Json } from "@/lib/database.types";

export async function POST(req: NextRequest) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const b = body as Record<string, unknown>;
  const attempt_id = typeof b.attempt_id === "string" ? b.attempt_id : null;
  const user_code = typeof b.user_code === "string" ? b.user_code : null;

  if (!attempt_id || !user_code) {
    return Response.json({ error: "attempt_id and user_code are required" }, { status: 400 });
  }

  // Fetch attempt — includes test_cases (never sent to client)
  const { data: attempt } = await supabase
    .from("kata_attempts")
    .select("*")
    .eq("id", attempt_id)
    .eq("user_id", user.id)
    .single();

  if (!attempt) return Response.json({ error: "Attempt not found" }, { status: 404 });

  const fnName = attempt.function_stub.match(/function\s+(\w+)/)?.[1];
  if (!fnName) {
    return Response.json({ error: "Could not parse function name from stub" }, { status: 400 });
  }

  const testCases = attempt.test_cases as Array<{ input: unknown; expected: unknown }>;

  // Build a self-contained Node.js harness.
  // fnName is sourced from the server-side stored function stub (AI-generated),
  // not from user input — safe to interpolate directly.
  const harness = `
${user_code}

const __tests = ${JSON.stringify(testCases)};
const __results = __tests.map(t => {
  try {
    const actual = ${fnName}(t.input);
    const passed = JSON.stringify(actual) === JSON.stringify(t.expected);
    return { passed, input: t.input, expected: t.expected, actual };
  } catch (e) {
    return { passed: false, input: t.input, expected: t.expected, error: e.message };
  }
});
process.stdout.write(JSON.stringify(__results));
`;

  let results: Array<{
    passed: boolean;
    input: unknown;
    expected: unknown;
    actual?: unknown;
    error?: string;
  }> = [];

  // networkPolicy: "deny-all" — no network access from within the sandbox
  let sandbox: Awaited<ReturnType<typeof Sandbox.create>> | undefined;
  try {
    sandbox = await Sandbox.create({ runtime: "node24", networkPolicy: "deny-all" });
    await sandbox.writeFiles([{ path: "solution.js", content: Buffer.from(harness) }]);
    const result = await sandbox.runCommand("node", ["solution.js"]);
    const stdout = await result.stdout();
    results = JSON.parse(stdout);
  } catch {
    // If sandbox provisioning, execution, or JSON parse fails, return all-failed results
    results = testCases.map((t) => ({
      passed: false,
      input: t.input,
      expected: t.expected,
      error: "Execution error",
    }));
  } finally {
    await sandbox?.stop();
  }

  const passed_count = results.filter((r) => r.passed).length;
  const total_count = results.length;

  await supabase
    .from("kata_attempts")
    .update({ user_code, results: results as unknown as Json, passed_count, total_count })
    .eq("id", attempt_id);

  return Response.json({ results, passed_count, total_count });
}
