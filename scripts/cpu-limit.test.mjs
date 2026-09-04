import { describe, it, expect } from 'vitest';
import {
  detectCpuLimit,
  maxWorkers,
  CGROUP_V2_CPU_MAX,
  CGROUP_V1_QUOTA,
  CGROUP_V1_PERIOD,
} from './cpu-limit.mjs';

/** Fake de readFileSync: so os caminhos presentes no mapa existem. */
function fakeFs(files) {
  return (path) => {
    if (!(path in files)) {
      const err = new Error(`ENOENT: no such file or directory, open '${path}'`);
      err.code = 'ENOENT';
      throw err;
    }
    return files[path];
  };
}

describe('detectCpuLimit', () => {
  it('cgroup v2 com limite: deriva quota/period', () => {
    const readFile = fakeFs({ [CGROUP_V2_CPU_MAX]: '200000 100000\n' });
    expect(detectCpuLimit({ readFile, cpuCount: 32 })).toBe(2);
  });

  it('cgroup v2 arredonda para baixo e nunca retorna 0', () => {
    const readFile = fakeFs({ [CGROUP_V2_CPU_MAX]: '50000 100000\n' });
    expect(detectCpuLimit({ readFile, cpuCount: 32 })).toBe(1);
  });

  it('cgroup v2 sem limite ("max"): cai para os.cpus()', () => {
    const readFile = fakeFs({ [CGROUP_V2_CPU_MAX]: 'max 100000\n' });
    expect(detectCpuLimit({ readFile, cpuCount: 8 })).toBe(8);
  });

  it('cgroup v1 com limite: deriva cfs_quota_us/cfs_period_us', () => {
    const readFile = fakeFs({
      [CGROUP_V1_QUOTA]: '400000\n',
      [CGROUP_V1_PERIOD]: '100000\n',
    });
    expect(detectCpuLimit({ readFile, cpuCount: 32 })).toBe(4);
  });

  it('cgroup v1 sem limite (quota -1): cai para os.cpus()', () => {
    const readFile = fakeFs({
      [CGROUP_V1_QUOTA]: '-1\n',
      [CGROUP_V1_PERIOD]: '100000\n',
    });
    expect(detectCpuLimit({ readFile, cpuCount: 6 })).toBe(6);
  });

  it('sem arquivo de cgroup (macOS local): cai para os.cpus()', () => {
    const readFile = fakeFs({});
    expect(detectCpuLimit({ readFile, cpuCount: 10 })).toBe(10);
  });

  it('cpuCount zero ou invalido nunca produz menos de 1', () => {
    const readFile = fakeFs({});
    expect(detectCpuLimit({ readFile, cpuCount: 0 })).toBe(1);
  });
});

describe('maxWorkers', () => {
  it('reserva uma CPU para o processo principal', () => {
    const readFile = fakeFs({ [CGROUP_V2_CPU_MAX]: '400000 100000\n' });
    expect(maxWorkers({ readFile, cpuCount: 32 })).toBe(3);
  });

  it('com uma unica CPU ainda retorna 1', () => {
    const readFile = fakeFs({ [CGROUP_V2_CPU_MAX]: '100000 100000\n' });
    expect(maxWorkers({ readFile, cpuCount: 32 })).toBe(1);
  });
});
