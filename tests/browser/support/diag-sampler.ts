// DIAGNOSTIC ONLY, never merged. Once a second it prints what each workerd process holds (memory, threads, open
// files) and how many TCP sockets the machine has by state, so the log shows what grows before workerd aborts.
// It serves /ready so Playwright can start it like the stand-in servers.
import { createServer } from "node:http";
import { readdirSync, readFileSync } from "node:fs";

const read = (path: string): string => {
  try {
    return readFileSync(path, "utf8");
  } catch {
    return "";
  }
};
const field = (status: string, name: string): string =>
  new RegExp(`^${name}:\\s*(.*)$`, "m").exec(status)?.[1] ?? "?";

const TCP_STATES: Record<string, string> = {
  "01": "ESTAB",
  "06": "TIME_WAIT",
  "08": "CLOSE_WAIT",
  "0A": "LISTEN",
};

/** Socket counts by TCP state, and how many of the established ones end at Postgres (port 5432 = 0x1538). */
function sockets(): string {
  const counts: Record<string, number> = {};
  let toPostgres = 0;
  for (const file of ["/proc/net/tcp", "/proc/net/tcp6"]) {
    for (const row of read(file).split("\n").slice(1)) {
      const parts = row.trim().split(/\s+/);
      if (parts.length < 4) continue;
      const state = TCP_STATES[parts[3] ?? ""] ?? `other${parts[3] ?? ""}`;
      counts[state] = (counts[state] ?? 0) + 1;
      if (state === "ESTAB" && (parts[2] ?? "").endsWith(":1538")) toPostgres++;
    }
  }
  return `tcp ${JSON.stringify(counts)} toPostgres=${String(toPostgres)}`;
}

function sample(): void {
  const parts: string[] = [];
  for (const pid of readdirSync("/proc").filter((name) => /^\d+$/.test(name))) {
    if (!read(`/proc/${pid}/comm`).startsWith("workerd")) continue;
    const status = read(`/proc/${pid}/status`);
    let fds = -1;
    try {
      fds = readdirSync(`/proc/${pid}/fd`).length;
    } catch {
      /* the process just ended */
    }
    parts.push(
      `workerd[${pid}] rss=${field(status, "VmRSS")} hwm=${field(status, "VmHWM")} threads=${field(status, "Threads")} fds=${String(fds)}`,
    );
  }
  const memory = /^MemAvailable:\s*(.*)$/m.exec(read("/proc/meminfo"))?.[1] ?? "?";
  process.stderr.write(
    `SAMPLE ${new Date().toISOString()} ${parts.join(" | ")} | memAvailable=${memory} | ${sockets()}\n`,
  );
}

setInterval(sample, 1000);
createServer((_request, response) => response.end("ok")).listen(12113, "127.0.0.1");
