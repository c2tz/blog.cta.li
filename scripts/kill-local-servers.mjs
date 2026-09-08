import { spawnSync } from "node:child_process";

const ports = [4321, 4322];

for (const port of ports) {
  const result = spawnSync("lsof", ["-ti", `TCP:${port}`, "-sTCP:LISTEN"], {
    encoding: "utf8",
  });

  if (result.status !== 0) continue;

  for (const value of result.stdout.trim().split(/\s+/)) {
    const pid = Number(value);
    if (!Number.isInteger(pid) || pid <= 0 || pid === process.pid) continue;
    try {
      process.kill(pid, "SIGTERM");
      console.log(`Stopped local server on port ${port} (pid ${pid}).`);
    } catch (error) {
      if (error?.code === "EPERM") {
        console.warn(
          `Could not stop local server on port ${port} (pid ${pid}); run this command in your terminal: kill ${pid}`,
        );
        continue;
      }
      if (error?.code !== "ESRCH") throw error;
    }
  }
}
