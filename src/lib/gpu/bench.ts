import { gbps, median } from "./estimate";

/**
 * In-browser memory bandwidth test. A compute shader reads and writes a storage buffer far bigger
 * than any GPU cache, so its speed is set by memory, the same limit LLM decoding runs into.
 */

// TypeScript's DOM types don't include WebGPU yet; this is the slice we use.
type ComputePass = {
  setPipeline(pipeline: unknown): void;
  setBindGroup(index: number, group: unknown): void;
  dispatchWorkgroups(x: number): void;
  end(): void;
};
type Device = {
  lost: Promise<unknown>;
  queue: { submit(commands: unknown[]): void; onSubmittedWorkDone(): Promise<void> };
  createBuffer(d: { size: number; usage: number }): unknown;
  createShaderModule(d: { code: string }): unknown;
  createComputePipeline(d: { layout: "auto"; compute: { module: unknown; entryPoint: string } }): {
    getBindGroupLayout(index: number): unknown;
  };
  createBindGroup(d: { layout: unknown; entries: { binding: number; resource: { buffer: unknown } }[] }): unknown;
  createCommandEncoder(): { beginComputePass(): ComputePass; finish(): unknown };
  pushErrorScope(filter: "validation" | "out-of-memory"): void;
  popErrorScope(): Promise<{ message: string } | null>;
  destroy(): void;
};
type Adapter = {
  info?: { vendor?: string; architecture?: string; description?: string };
  limits: { maxBufferSize: number; maxStorageBufferBindingSize: number };
  requestDevice(d: { requiredLimits: Record<string, number> }): Promise<Device>;
};
type GpuNavigator = Navigator & {
  gpu?: { requestAdapter(o: { powerPreference: "high-performance" }): Promise<Adapter | null> };
};

export type BenchResult = { gbps: number; name: string; maxBufferSize: number; testBytes: number };

/** A failure with a message written for people. Anything else gets a generic message. */
export class BenchError extends Error {}

export const hasWebGPU = () => "gpu" in navigator;

const MIB = 2 ** 20;
const GROUPS = 4096; // of 256 threads, each striding through the buffer
const SAMPLES = 9;
const TARGET_MS = 300; // per timed sample, so timer and submit overhead stay under 1%

const SHADER = /* wgsl */ `
@group(0) @binding(0) var<storage, read_write> data: array<vec4<f32>>;

@compute @workgroup_size(256)
fn main(@builtin(global_invocation_id) id: vec3<u32>, @builtin(num_workgroups) groups: vec3<u32>) {
  let stride = groups.x * 256u;
  for (var i = id.x; i < arrayLength(&data); i += stride) {
    data[i] = data[i] + vec4<f32>(1.0);
  }
}`;

/** Reports progress as passes finish, with the median so far. Takes a few seconds. */
export async function runBench(onProgress: (done: number, total: number, gbpsSoFar?: number) => void): Promise<BenchResult> {
  const adapter = await (navigator as GpuNavigator).gpu?.requestAdapter({ powerPreference: "high-performance" });
  if (!adapter)
    throw new BenchError(
      "Your browser has WebGPU but didn't hand this page a graphics card. Hardware acceleration may be off in its settings.",
    );

  // 256 MB, or as much as one binding allows (never under 128 MB).
  const size = Math.min(256 * MIB, adapter.limits.maxStorageBufferBindingSize);
  const device = await adapter.requestDevice({ requiredLimits: { maxStorageBufferBindingSize: size } });
  let lost = false;
  void device.lost.then(() => (lost = true));
  try {
    device.pushErrorScope("out-of-memory");
    device.pushErrorScope("validation");
    const buffer = device.createBuffer({ size, usage: 0x80 }); // GPUBufferUsage.STORAGE
    const shader = device.createShaderModule({ code: SHADER });
    const pipeline = device.createComputePipeline({ layout: "auto", compute: { module: shader, entryPoint: "main" } });
    const group = device.createBindGroup({ layout: pipeline.getBindGroupLayout(0), entries: [{ binding: 0, resource: { buffer } }] });
    const invalid = await device.popErrorScope();
    if (await device.popErrorScope())
      throw new BenchError(`Your GPU couldn't set aside ${size / MIB} MB for the test. Close other apps that use it and try again.`);
    if (invalid) throw new Error(invalid.message);

    /** Runs `reps` full sweeps in one submission and returns how many milliseconds they took. */
    const time = async (reps: number) => {
      const encoder = device.createCommandEncoder();
      const pass = encoder.beginComputePass();
      pass.setPipeline(pipeline);
      pass.setBindGroup(0, group);
      for (let i = 0; i < reps; i++) pass.dispatchWorkgroups(GROUPS);
      pass.end();
      const start = performance.now();
      device.queue.submit([encoder.finish()]);
      await device.queue.onSubmittedWorkDone();
      if (lost) throw new BenchError("The GPU was reset during the test. Close other apps that use it and try again.");
      return performance.now() - start;
    };

    onProgress(0, SAMPLES);
    await time(1); // warm-up: first use of the pipeline, clocks ramping up
    const reps = Math.min(400, Math.max(1, Math.round(TARGET_MS / Math.max(0.05, (await time(2)) / 2))));
    const samples: number[] = [];
    for (let i = 1; i <= SAMPLES; i++) {
      samples.push(gbps(2 * size * reps, await time(reps))); // each sweep reads and writes every byte
      onProgress(i, SAMPLES, median(samples));
    }

    const info = adapter.info ?? {};
    const name = info.description || [info.vendor, info.architecture].filter(Boolean).join(" ");
    return {
      gbps: median(samples),
      name: name.charAt(0).toUpperCase() + name.slice(1),
      maxBufferSize: adapter.limits.maxBufferSize,
      testBytes: size,
    };
  } finally {
    device.destroy(); // frees the buffer too
  }
}
