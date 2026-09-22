import bcrypt from "bcryptjs";
import fs from "fs";
import os from "os";
import path from "path";
import { Worker } from "worker_threads";

interface IPasswordTask {
  id: number;
  plain: string;
  hash: string;
  resolve: (matches: boolean) => void;
  reject: (error: Error) => void;
  timeout: NodeJS.Timeout;
}

interface IWorkerSlot {
  worker: Worker;
  task?: IPasswordTask;
}

const MAX_QUEUE_SIZE = 256;
const TASK_TIMEOUT_MS = 30_000;
const availableCpus =
  typeof os.availableParallelism === "function" ? os.availableParallelism() : os.cpus().length;
const workerCount = Math.max(1, Math.min(4, availableCpus - 1 || 1));

class PasswordWorkerPool {
  private readonly workerPath = path.resolve(__dirname, "../workers/password.worker.js");
  private readonly slots: IWorkerSlot[] = [];
  private readonly queue: IPasswordTask[] = [];
  private nextId = 1;
  private shuttingDown = false;

  isAvailable(): boolean {
    return fs.existsSync(this.workerPath);
  }

  verify(plain: string, hash: string): Promise<boolean> {
    if (this.shuttingDown || !this.isAvailable()) {
      return bcrypt.compare(plain, hash);
    }
    if (this.queue.length >= MAX_QUEUE_SIZE) {
      return bcrypt.compare(plain, hash);
    }
    this.ensureWorkers();
    return new Promise<boolean>((resolve, reject) => {
      const id = this.nextId++;
      const timeout = setTimeout(() => {
        const queuedIndex = this.queue.findIndex((task) => task.id === id);
        if (queuedIndex >= 0) this.queue.splice(queuedIndex, 1);
        const slot = this.slots.find((candidate) => candidate.task?.id === id);
        if (slot) slot.task = undefined;
        reject(new Error("Password verification timed out"));
        this.dispatch();
      }, TASK_TIMEOUT_MS);
      timeout.unref();
      this.queue.push({ id, plain, hash, resolve, reject, timeout });
      this.dispatch();
    });
  }

  async close(): Promise<void> {
    this.shuttingDown = true;
    const error = new Error("Password verification is shutting down");
    for (const task of this.queue.splice(0)) {
      clearTimeout(task.timeout);
      task.reject(error);
    }
    const workers = this.slots.splice(0);
    for (const slot of workers) {
      if (slot.task) {
        clearTimeout(slot.task.timeout);
        slot.task.reject(error);
      }
    }
    await Promise.all(workers.map((slot) => slot.worker.terminate()));
  }

  private ensureWorkers(): void {
    if (this.slots.length) return;
    for (let index = 0; index < workerCount; index += 1) this.createWorker();
  }

  private createWorker(): void {
    const worker = new Worker(this.workerPath);
    worker.unref();
    const slot: IWorkerSlot = { worker };
    this.slots.push(slot);
    worker.on("message", (result: { id: number; matches?: boolean; error?: string }) => {
      if (!slot.task || slot.task.id !== result.id) return;
      const task = slot.task;
      slot.task = undefined;
      clearTimeout(task.timeout);
      if (result.error) task.reject(new Error(result.error));
      else task.resolve(result.matches === true);
      this.dispatch();
    });
    worker.on("error", (error) => this.replaceFailedWorker(slot, error));
    worker.on("exit", (code) => {
      if (code !== 0) this.replaceFailedWorker(slot, new Error(`Password worker exited (${code})`));
    });
  }

  private replaceFailedWorker(slot: IWorkerSlot, error: Error): void {
    const index = this.slots.indexOf(slot);
    if (index < 0) return;
    this.slots.splice(index, 1);
    if (slot.task) {
      clearTimeout(slot.task.timeout);
      slot.task.reject(error);
      slot.task = undefined;
    }
    if (!this.shuttingDown) this.createWorker();
    this.dispatch();
  }

  private dispatch(): void {
    for (const slot of this.slots) {
      if (slot.task) continue;
      const task = this.queue.shift();
      if (!task) return;
      slot.task = task;
      slot.worker.postMessage({ id: task.id, plain: task.plain, hash: task.hash });
    }
  }
}

const passwordWorkerPool = new PasswordWorkerPool();

export const passwordVerifier = {
  compare: (plain: string, hash: string) => passwordWorkerPool.verify(plain, hash),
  close: () => passwordWorkerPool.close(),
};
