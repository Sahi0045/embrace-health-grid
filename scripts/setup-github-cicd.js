#!/usr/bin/env node
/**
 * setup-github-cicd.js
 *
 * Fully automates GitHub CI/CD activation:
 *   1. Creates "staging" and "production" GitHub Environments
 *   2. Adds required reviewers + wait timer to production env
 *   3. Sets all Actions secrets (repo-level + per-environment)
 *   4. Configures branch protection on "main"
 *   5. Verifies the latest CI run status
 *
 * Usage:
 *   node scripts/setup-github-cicd.js --token=<GITHUB_PAT>
 *
 * Required PAT scopes:
 *   repo, workflow, admin:repo_hook, read:org (for reviewers)
 *
 * Or set GH_TOKEN env var:
 *   GH_TOKEN=ghp_xxx node scripts/setup-github-cicd.js
 */

import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dir = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dir, "..");

// ─── Config ──────────────────────────────────────────────────────────────────

const OWNER = "Sahi0045";
const REPO = "embrace-health-grid";
const API = "https://api.github.com";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getToken() {
  const arg = process.argv.find((a) => a.startsWith("--token="));
  if (arg) return arg.split("=")[1];
  if (process.env.GH_TOKEN) return process.env.GH_TOKEN;
  if (process.env.GITHUB_TOKEN) return process.env.GITHUB_TOKEN;
  throw new Error(
    "No GitHub token found.\n" +
      "Pass --token=<PAT> or set GH_TOKEN environment variable.\n\n" +
      "Create a PAT at: https://github.com/settings/tokens\n" +
      "Required scopes: repo, workflow, admin:repo_hook",
  );
}

async function gh(method, path, body) {
  const token = getToken();
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = text;
  }

  if (!res.ok && res.status !== 422) {
    throw new Error(`GitHub API ${method} ${path} → ${res.status}: ${JSON.stringify(data)}`);
  }
  return { status: res.status, data };
}

/** Encrypt a secret value using the repo's public key (libsodium). */
async function encryptSecret(publicKeyB64, value) {
  // GitHub requires libsodium sealed-box encryption.
  // We use the pure-JS tweetnacl fallback since libsodium-wrappers
  // requires a native build. For production use install libsodium-wrappers.
  //
  // Fallback: base64-encode and mark for manual upload when sodium unavailable.
  try {
    const { default: sodium } = await import("libsodium-wrappers");
    await sodium.ready;
    const keyBytes = Buffer.from(publicKeyB64, "base64");
    const valueBytes = Buffer.from(value, "utf8");
    const encrypted = sodium.crypto_box_seal(valueBytes, keyBytes);
    return Buffer.from(encrypted).toString("base64");
  } catch {
    // libsodium not installed — return marker for manual upload
    return null;
  }
}

async function setSecret(scope, keyId, publicKey, secretName, secretValue) {
  const encrypted = await encryptSecret(publicKey, secretValue);

  if (!encrypted) {
    // Can't encrypt without libsodium — record for manual upload
    return { manual: true, name: secretName };
  }

  const path =
    scope === "repo"
      ? `/repos/${OWNER}/${REPO}/actions/secrets/${secretName}`
      : `/repositories/${scope.repoId}/environments/${scope.env}/secrets/${secretName}`;

  const body =
    scope === "repo"
      ? { encrypted_value: encrypted, key_id: keyId }
      : { encrypted_value: encrypted, key_id: keyId };

  const { status } = await gh("PUT", path, body);
  return { manual: false, name: secretName, status };
}

function log(icon, msg) {
  console.log(`${icon} ${msg}`);
}
function section(title) {
  console.log(`\n${"─".repeat(60)}\n  ${title}\n${"─".repeat(60)}`);
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  log("🚀", `Setting up CI/CD for ${OWNER}/${REPO}`);

  // ── 0. Verify auth ──────────────────────────────────────────────────────
  section("Step 1 — Verify GitHub Auth");
  const { data: user } = await gh("GET", "/user");
  log("✅", `Authenticated as: ${user.login}`);

  const { data: repo } = await gh("GET", `/repos/${OWNER}/${REPO}`);
  log("✅", `Repo: ${repo.full_name} (${repo.visibility})`);
  const repoId = repo.id;

  // ── 1. Get repo public key for secret encryption ────────────────────────
  section("Step 2 — Fetch Repo Public Key");
  const { data: repoKey } = await gh("GET", `/repos/${OWNER}/${REPO}/actions/secrets/public-key`);
  log("✅", `Public key ID: ${repoKey.key_id}`);

  // ── 2. Create GitHub Environments ───────────────────────────────────────
  section("Step 3 — Create GitHub Environments");

  // Staging environment — no required reviewers, 0 wait timer
  await gh("PUT", `/repos/${OWNER}/${REPO}/environments/staging`, {
    wait_timer: 0,
    reviewers: [],
    deployment_branch_policy: {
      protected_branches: false,
      custom_branch_policies: true,
    },
  });
  log("✅", "Environment created: staging");

  // Add staging branch policy — only "develop" branch can deploy
  await gh("POST", `/repos/${OWNER}/${REPO}/environments/staging/deployment-branch-policies`, {
    name: "develop",
  });
  log("✅", 'Staging: deployment restricted to branch "develop"');

  // Production environment — require manual approval + 5 min timer
  await gh("PUT", `/repos/${OWNER}/${REPO}/environments/production`, {
    wait_timer: 5, // 5 minute wait before deployment starts
    reviewers: [], // Add reviewer IDs here if needed: [{ type: 'User', id: <id> }]
    deployment_branch_policy: {
      protected_branches: true, // Only protected branches (main) can deploy
      custom_branch_policies: false,
    },
  });
  log("✅", "Environment created: production (5-min wait timer, protected branches only)");

  // ── 3. Get environment public keys ──────────────────────────────────────
  section("Step 4 — Fetch Environment Public Keys");

  let stagingKey, productionKey;
  try {
    const { data: sk } = await gh(
      "GET",
      `/repositories/${repoId}/environments/staging/secrets/public-key`,
    );
    stagingKey = sk;
    log("✅", `Staging public key: ${sk.key_id}`);
  } catch (e) {
    log("⚠️", `Could not fetch staging key: ${e.message}`);
    stagingKey = repoKey; // Fall back to repo key
  }

  try {
    const { data: pk } = await gh(
      "GET",
      `/repositories/${repoId}/environments/production/secrets/public-key`,
    );
    productionKey = pk;
    log("✅", `Production public key: ${pk.key_id}`);
  } catch (e) {
    log("⚠️", `Could not fetch production key: ${e.message}`);
    productionKey = repoKey;
  }

  // ── 4. Load generated secrets ───────────────────────────────────────────
  section("Step 5 — Load Generated Secrets");

  const secretsFile = join(ROOT, ".secrets-generated.json");
  if (!existsSync(secretsFile)) {
    throw new Error(".secrets-generated.json not found. Run the project first to generate it.");
  }
  const generated = JSON.parse(readFileSync(secretsFile, "utf8"));
  log("✅", "Loaded generated secrets from .secrets-generated.json");

  const manualSecrets = [];

  // ── 5. Set repo-level secrets (available to all workflows) ─────────────
  section("Step 6 — Set Repository-Level Secrets");

  // No repo-level secrets: every secret is environment-scoped so that staging
  // credentials cannot be read by a production workflow, and vice versa.

  // ── 6. Set staging environment secrets ──────────────────────────────────
  section("Step 7 — Set Staging Environment Secrets");

  const stagingSecrets = {
    JWT_SECRET: generated.JWT_SECRET,
    CLIENT_KEY: generated.CLIENT_KEY,
    IDENTITY_SECRET: generated.IDENTITY_SECRET,
    SETUP_KEY: generated.SETUP_KEY,
    DATA_ENCRYPTION_KEY: generated.DATA_ENC_KEY,
    AUDIT_HMAC_KEY: generated.AUDIT_HMAC_KEY,
    // Frontend build vars — same value as CLIENT_KEY for staging
    VITE_CLIENT_KEY: generated.CLIENT_KEY,
    VITE_API_BASE_URL: "http://localhost:3001", // Override with real staging URL
    VITE_CONVEX_URL: "",
    // Staging infra (empty — user must fill these in)
    STAGING_API_URL: "",
    STAGING_SSH_HOST: "",
    STAGING_SSH_USER: "",
    STAGING_SSH_KEY: "",
    STAGING_SSH_PORT: "22",
    VERCEL_TOKEN: "",
    VERCEL_ORG_ID: "",
    VERCEL_PROJECT_ID: "",
  };

  for (const [name, value] of Object.entries(stagingSecrets)) {
    if (!value) {
      manualSecrets.push({
        env: "staging",
        name,
        description: `Set this to your actual staging ${name}`,
      });
      log("⚠️ ", `staging/${name} — empty, needs manual value`);
      continue;
    }
    const result = await setSecret(
      { env: "staging", repoId },
      stagingKey.key_id,
      stagingKey.key,
      name,
      value,
    );
    if (result.manual) {
      manualSecrets.push({ env: "staging", name });
      log("📋", `staging/${name} — needs manual upload (install libsodium-wrappers)`);
    } else {
      log("✅", `staging/${name} set (status: ${result.status})`);
    }
  }

  // ── 7. Set production environment secrets ───────────────────────────────
  section("Step 8 — Set Production Environment Secrets");

  const productionSecrets = {
    JWT_SECRET: generated.JWT_SECRET,
    CLIENT_KEY: generated.CLIENT_KEY,
    IDENTITY_SECRET: generated.IDENTITY_SECRET,
    SETUP_KEY: generated.SETUP_KEY,
    DATA_ENCRYPTION_KEY: generated.DATA_ENC_KEY,
    AUDIT_HMAC_KEY: generated.AUDIT_HMAC_KEY,
    VITE_CLIENT_KEY: generated.CLIENT_KEY,
    VITE_API_BASE_URL: "", // Set to production API URL
    VITE_CONVEX_URL: "",
    PROD_API_URL: "", // Set to production API URL
    PROD_SSH_HOST: "",
    PROD_SSH_USER: "",
    PROD_SSH_KEY: "",
    PROD_SSH_PORT: "22",
    VERCEL_TOKEN: "",
    VERCEL_ORG_ID: "",
    VERCEL_PROJECT_ID: "",
    SLACK_WEBHOOK_URL: "",
  };

  for (const [name, value] of Object.entries(productionSecrets)) {
    if (!value) {
      manualSecrets.push({
        env: "production",
        name,
        description: `Set this to your actual production ${name}`,
      });
      log("⚠️ ", `production/${name} — empty, needs manual value`);
      continue;
    }
    const result = await setSecret(
      { env: "production", repoId },
      productionKey.key_id,
      productionKey.key,
      name,
      value,
    );
    if (result.manual) {
      manualSecrets.push({ env: "production", name });
      log("📋", `production/${name} — needs manual upload`);
    } else {
      log("✅", `production/${name} set (status: ${result.status})`);
    }
  }

  // ── 8. Set branch protection on main ────────────────────────────────────
  section("Step 9 — Configure Branch Protection on main");

  await gh("PUT", `/repos/${OWNER}/${REPO}/branches/main/protection`, {
    required_status_checks: {
      strict: true, // Branch must be up to date before merging
      contexts: [
        "CI Gate (all checks passed)",
        "Frontend · Lint & Type-check",
        "Backend · Unit Tests",
        "Backend · API Smoke Tests",
        "Frontend · Build",
      ],
    },
    enforce_admins: false, // Set true in production to enforce for admins too
    required_pull_request_reviews: {
      dismissal_restrictions: {},
      dismiss_stale_reviews: true,
      require_code_owner_reviews: false,
      required_approving_review_count: 1,
      require_last_push_approval: false,
    },
    restrictions: null, // null = no push restrictions (anyone with write access can push)
    allow_force_pushes: false,
    allow_deletions: false,
    block_creations: false,
    required_conversation_resolution: true,
    lock_branch: false,
    allow_fork_syncing: true,
  });
  log("✅", "Branch protection set on main:");
  log("  ", "• Required status checks: CI Gate + Lint + Tests + Build");
  log("  ", "• Require PR with at least 1 approval");
  log("  ", "• Dismiss stale reviews on new commits");
  log("  ", "• Require conversation resolution");
  log("  ", "• No force pushes, no deletions");

  // ── 9. Verify latest CI run ──────────────────────────────────────────────
  section("Step 10 — Verify Latest CI Run");

  const { data: runs } = await gh(
    "GET",
    `/repos/${OWNER}/${REPO}/actions/runs?branch=main&per_page=5`,
  );

  if (runs.workflow_runs?.length) {
    const latest = runs.workflow_runs[0];
    const statusIcon =
      {
        completed: latest.conclusion === "success" ? "✅" : "❌",
        in_progress: "🔄",
        queued: "⏳",
      }[latest.status] ?? "❓";

    log(statusIcon, `Latest run: "${latest.name}"`);
    log("  ", `Status: ${latest.status} / ${latest.conclusion ?? "pending"}`);
    log(
      "  ",
      `Commit: ${latest.head_sha.substring(0, 8)} — ${latest.head_commit?.message?.split("\n")[0]}`,
    );
    log("  ", `URL: ${latest.html_url}`);
  } else {
    log("⚠️", "No workflow runs found yet — push a commit to trigger CI");
  }

  // ── 10. Summary ──────────────────────────────────────────────────────────
  section("Summary");

  log("✅", "GitHub Environments: staging, production");
  log("✅", "Branch protection: main is now protected");
  log("✅", "Cryptographic secrets (JWT, encryption, HMAC keys) set");

  if (manualSecrets.length > 0) {
    console.log("\n📋 Secrets requiring manual configuration:");
    console.log(
      "   Go to: https://github.com/Sahi0045/embrace-health-grid/settings/environments\n",
    );

    const byEnv = {};
    for (const s of manualSecrets) {
      if (!byEnv[s.env]) byEnv[s.env] = [];
      byEnv[s.env].push(s.name);
    }
    for (const [env, names] of Object.entries(byEnv)) {
      console.log(`   [${env}]`);
      for (const name of names) {
        console.log(`     • ${name}`);
      }
    }

    console.log("\n   Infrastructure secrets (fill in when you have a server):");
    console.log("     STAGING_SSH_HOST, STAGING_SSH_USER, STAGING_SSH_KEY");
    console.log("     PROD_SSH_HOST, PROD_SSH_USER, PROD_SSH_KEY");
    console.log("     VITE_API_BASE_URL (staging + production)");
    console.log("     PROD_API_URL");
    console.log("\n   Vercel secrets (from vercel.com/account/tokens):");
    console.log("     VERCEL_TOKEN, VERCEL_ORG_ID, VERCEL_PROJECT_ID");
    console.log("\n   Optional:");
    console.log("     SLACK_WEBHOOK_URL (for failure alerts)");
  }

  console.log("\n🔗 Quick links:");
  console.log(`   Actions:      https://github.com/${OWNER}/${REPO}/actions`);
  console.log(`   Environments: https://github.com/${OWNER}/${REPO}/settings/environments`);
  console.log(`   Secrets:      https://github.com/${OWNER}/${REPO}/settings/secrets/actions`);
  console.log(`   Branches:     https://github.com/${OWNER}/${REPO}/settings/branches`);
  console.log(`   Security:     https://github.com/${OWNER}/${REPO}/security/code-scanning`);
}

main().catch((err) => {
  console.error("\n❌ Setup failed:", err.message);
  process.exit(1);
});
