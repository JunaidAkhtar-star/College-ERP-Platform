import bcrypt from "bcryptjs";
import { parentPort } from "worker_threads";

interface IPasswordWork {
  id: number;
  plain: string;
  hash: string;
}

if (!parentPort) throw new Error("Password worker requires a parent port");

parentPort.on("message", async (work: IPasswordWork) => {
  try {
    const matches = await bcrypt.compare(work.plain, work.hash);
    parentPort?.postMessage({ id: work.id, matches });
  } catch (error) {
    parentPort?.postMessage({
      id: work.id,
      error: error instanceof Error ? error.message : "Password verification failed",
    });
  }
});
