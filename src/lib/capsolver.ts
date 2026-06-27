const CAPSOLVER_BASE = "https://api.capsolver.com";

function getApiKey(): string | undefined {
  if (typeof process === "undefined" || !process.env) return undefined;
  return process.env.CAPSOLVER_API_KEY;
}

interface CapSolverTask {
  type: string;
  websiteURL?: string;
  websiteKey?: string;
  pageURL?: string;
  [key: string]: unknown;
}

interface CapSolverResponse {
  errorId: number;
  errorCode?: string;
  errorDescription?: string;
  taskId?: string;
  status?: string;
  solution?: { token?: string; [key: string]: unknown };
}

async function createTask(task: CapSolverTask): Promise<string | null> {
  const apiKey = getApiKey();
  if (!apiKey) return null;
  try {
    const res = await fetch(`${CAPSOLVER_BASE}/createTask`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clientKey: apiKey, task }),
    });
    const data = (await res.json()) as CapSolverResponse;
    if (data.errorId !== 0 || !data.taskId) return null;
    return data.taskId;
  } catch {
    return null;
  }
}

async function getTaskResult(taskId: string): Promise<CapSolverResponse | null> {
  const apiKey = getApiKey();
  if (!apiKey) return null;
  for (let i = 0; i < 30; i++) {
    try {
      const res = await fetch(`${CAPSOLVER_BASE}/getTaskResult`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientKey: apiKey, taskId }),
      });
      const data = (await res.json()) as CapSolverResponse;
      if (data.status === "ready") return data;
    } catch {
      /* ignore */
    }
    await new Promise((r) => setTimeout(r, 2000));
  }
  return null;
}

export async function solveTurnstile(
  websiteURL: string,
  websiteKey: string,
): Promise<string | null> {
  const taskId = await createTask({ type: "AntiTurnstileTaskProxyLess", websiteURL, websiteKey });
  if (!taskId) return null;
  const result = await getTaskResult(taskId);
  return result?.solution?.token ?? null;
}

export async function solveRecaptchaV2(
  websiteURL: string,
  websiteKey: string,
): Promise<string | null> {
  const taskId = await createTask({ type: "ReCaptchaV2TaskProxyLess", websiteURL, websiteKey });
  if (!taskId) return null;
  const result = await getTaskResult(taskId);
  return result?.solution?.token ?? null;
}
