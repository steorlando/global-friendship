#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

const WRITE_COMMANDS = new Set(["insert", "update", "delete"]);

function printUsage() {
  console.log(`
Supabase admin helper

Usage:
  node scripts/supabase-admin.mjs list-tables
  node scripts/supabase-admin.mjs select --table partecipanti [--select "*"] [--limit 100] [--filter "id:eq:<uuid>"] [--order "created_at:desc"]
  SUPABASE_ALLOW_WRITES=1 node scripts/supabase-admin.mjs insert --table partecipanti --json '{"nome":"Mario"}' --confirm
  SUPABASE_ALLOW_WRITES=1 node scripts/supabase-admin.mjs update --table partecipanti --json '{"citta":"Roma"}' --filter "id:eq:<uuid>" --confirm
  SUPABASE_ALLOW_WRITES=1 node scripts/supabase-admin.mjs delete --table partecipanti --filter "id:eq:<uuid>" --confirm

Options:
  --table <name>             Table name
  --select <columns>         Select projection (default: *)
  --limit <n>                Max rows for select (default: 100)
  --filter <f>               Repeatable. Format: column:operator:value
  --order <o>                Format: column:asc|desc
  --json <payload>           JSON payload for insert/update
  --confirm                  Required for write commands

Environment:
  SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL
  SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_SECRET_KEY)
  SUPABASE_ALLOW_WRITES=1    Required for write commands
`);
}

function loadEnvFile(fileName) {
  const filePath = path.resolve(process.cwd(), fileName);
  if (!fs.existsSync(filePath)) {
    return;
  }

  const content = fs.readFileSync(filePath, "utf8");
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex <= 0) {
      continue;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    const rawValue = trimmed.slice(separatorIndex + 1).trim();

    if (!key || process.env[key] !== undefined) {
      continue;
    }

    const unquotedValue =
      (rawValue.startsWith('"') && rawValue.endsWith('"')) ||
      (rawValue.startsWith("'") && rawValue.endsWith("'"))
        ? rawValue.slice(1, -1)
        : rawValue;

    process.env[key] = unquotedValue;
  }
}

function parseArgs(argv) {
  const command = argv[0];
  const flags = new Map();
  const bools = new Set();
  const positional = [];

  for (let i = 1; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith("--")) {
      positional.push(token);
      continue;
    }

    const key = token.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith("--")) {
      bools.add(key);
      continue;
    }

    if (!flags.has(key)) {
      flags.set(key, []);
    }
    flags.get(key).push(next);
    i += 1;
  }

  return {
    command,
    flags,
    bools,
    positional,
  };
}

function getSingleFlag(args, key) {
  const values = args.flags.get(key);
  if (!values || values.length === 0) {
    return undefined;
  }
  return values[values.length - 1];
}

function getMultiFlag(args, key) {
  return args.flags.get(key) ?? [];
}

function parseJson(value, label) {
  try {
    return JSON.parse(value);
  } catch {
    throw new Error(`Invalid JSON in ${label}.`);
  }
}

function parseFilter(raw) {
  const parts = raw.split(":");
  if (parts.length < 3) {
    throw new Error(
      `Invalid filter "${raw}". Expected format: column:operator:value`
    );
  }

  const column = parts[0]?.trim();
  const operator = parts[1]?.trim();
  const valuePart = parts.slice(2).join(":").trim();

  if (!column || !operator) {
    throw new Error(
      `Invalid filter "${raw}". Expected format: column:operator:value`
    );
  }

  let value = valuePart;
  if (valuePart === "null") {
    value = null;
  } else if (valuePart === "true") {
    value = true;
  } else if (valuePart === "false") {
    value = false;
  } else if (valuePart.startsWith("[") && valuePart.endsWith("]")) {
    value = parseJson(valuePart, `filter "${raw}"`);
  }

  return { column, operator, value };
}

function applyFilters(builder, rawFilters) {
  let next = builder;
  for (const rawFilter of rawFilters) {
    const filter = parseFilter(rawFilter);
    next = next.filter(filter.column, filter.operator, filter.value);
  }
  return next;
}

function requireTable(command, args) {
  const table = getSingleFlag(args, "table");
  if (!table) {
    throw new Error(`--table is required for "${command}".`);
  }
  return table;
}

function assertWriteGuards(command, args) {
  if (!WRITE_COMMANDS.has(command)) {
    return;
  }

  const allowWrites =
    process.env.SUPABASE_ALLOW_WRITES === "1" ||
    process.env.SUPABASE_ALLOW_WRITES === "true";

  if (!allowWrites) {
    throw new Error(
      'Write guard is active. Set SUPABASE_ALLOW_WRITES=1 to enable writes.'
    );
  }

  if (!args.bools.has("confirm")) {
    throw new Error('Write guard is active. Add "--confirm" to proceed.');
  }
}

async function listTables(supabaseUrl, serviceKey) {
  const response = await fetch(`${supabaseUrl}/rest/v1/`, {
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
    },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Unable to list tables (${response.status}): ${body}`);
  }

  const spec = await response.json();
  const paths = Object.keys(spec.paths ?? {});

  const tables = paths
    .filter((path) => /^\/[^/]+$/.test(path))
    .map((path) => path.slice(1))
    .sort((a, b) => a.localeCompare(b));

  const rpcFunctions = paths
    .filter((path) => path.startsWith("/rpc/"))
    .map((path) => path.replace("/rpc/", ""))
    .sort((a, b) => a.localeCompare(b));

  console.log(
    JSON.stringify(
      {
        schema: spec.info?.title ?? null,
        tableCount: tables.length,
        tables,
        rpcCount: rpcFunctions.length,
        rpcFunctions,
      },
      null,
      2
    )
  );
}

async function main() {
  loadEnvFile(".env.local");
  loadEnvFile(".env");

  const args = parseArgs(process.argv.slice(2));
  const command = args.command;

  if (!command || command === "--help" || command === "-h") {
    printUsage();
    return;
  }

  const supabaseUrl =
    process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY;

  if (!supabaseUrl || !serviceKey) {
    throw new Error(
      "Missing Supabase environment variables. Set SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_SECRET_KEY)."
    );
  }

  assertWriteGuards(command, args);

  if (command === "list-tables") {
    await listTables(supabaseUrl, serviceKey);
    return;
  }

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  if (command === "select") {
    const table = requireTable(command, args);
    const projection = getSingleFlag(args, "select") ?? "*";
    const limitRaw = getSingleFlag(args, "limit") ?? "100";
    const limit = Number.parseInt(limitRaw, 10);
    if (Number.isNaN(limit) || limit <= 0) {
      throw new Error("--limit must be a positive integer.");
    }

    let query = supabase.from(table).select(projection, { count: "exact" }).limit(limit);
    query = applyFilters(query, getMultiFlag(args, "filter"));

    const order = getSingleFlag(args, "order");
    if (order) {
      const [column, direction = "asc"] = order.split(":");
      if (!column) {
        throw new Error(`Invalid --order value "${order}".`);
      }
      query = query.order(column, { ascending: direction !== "desc" });
    }

    const { data, error, count } = await query;
    if (error) {
      throw new Error(error.message);
    }

    console.log(
      JSON.stringify(
        {
          count,
          rows: data ?? [],
        },
        null,
        2
      )
    );
    return;
  }

  if (command === "insert") {
    const table = requireTable(command, args);
    const payloadRaw = getSingleFlag(args, "json");
    if (!payloadRaw) {
      throw new Error("--json payload is required for insert.");
    }

    const payload = parseJson(payloadRaw, "--json");
    const { data, error } = await supabase.from(table).insert(payload).select();
    if (error) {
      throw new Error(error.message);
    }

    console.log(JSON.stringify({ affectedRows: data?.length ?? 0, rows: data ?? [] }, null, 2));
    return;
  }

  if (command === "update") {
    const table = requireTable(command, args);
    const payloadRaw = getSingleFlag(args, "json");
    if (!payloadRaw) {
      throw new Error("--json payload is required for update.");
    }

    const filters = getMultiFlag(args, "filter");
    if (filters.length === 0) {
      throw new Error("At least one --filter is required for update.");
    }

    const payload = parseJson(payloadRaw, "--json");
    let query = supabase.from(table).update(payload);
    query = applyFilters(query, filters);

    const { data, error } = await query.select();
    if (error) {
      throw new Error(error.message);
    }

    console.log(JSON.stringify({ affectedRows: data?.length ?? 0, rows: data ?? [] }, null, 2));
    return;
  }

  if (command === "delete") {
    const table = requireTable(command, args);
    const filters = getMultiFlag(args, "filter");
    if (filters.length === 0) {
      throw new Error("At least one --filter is required for delete.");
    }

    let query = supabase.from(table).delete();
    query = applyFilters(query, filters);

    const { data, error } = await query.select();
    if (error) {
      throw new Error(error.message);
    }

    console.log(JSON.stringify({ affectedRows: data?.length ?? 0, rows: data ?? [] }, null, 2));
    return;
  }

  throw new Error(`Unknown command "${command}".`);
}

main().catch((error) => {
  console.error(`Error: ${error.message}`);
  printUsage();
  process.exit(1);
});
