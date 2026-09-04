// Dentro de um container, os.cpus() reporta as CPUs do HOST, nao o limite do
// cgroup. Runners de teste dimensionados por os.cpus() sobem workers demais e o
// job morre com todos os testes passando. Este helper le o limite real do cgroup.

import fs from 'node:fs';
import os from 'node:os';

export const CGROUP_V2_CPU_MAX = '/sys/fs/cgroup/cpu.max';
export const CGROUP_V1_QUOTA = '/sys/fs/cgroup/cpu/cpu.cfs_quota_us';
export const CGROUP_V1_PERIOD = '/sys/fs/cgroup/cpu/cpu.cfs_period_us';

function readTrimmed(readFile, path) {
  try {
    return readFile(path, 'utf8').trim();
  } catch {
    return null;
  }
}

function quotaToCpus(quota, period) {
  const q = Number(quota);
  const p = Number(period);
  if (!Number.isFinite(q) || !Number.isFinite(p) || q <= 0 || p <= 0) return null;
  return Math.max(1, Math.floor(q / p));
}

/**
 * CPUs efetivamente disponiveis: limite do cgroup quando houver, senao os.cpus().
 *
 * @param {{ readFile?: typeof fs.readFileSync, cpuCount?: number }} [deps]
 * @returns {number} sempre >= 1
 */
export function detectCpuLimit(deps = {}) {
  const readFile = deps.readFile ?? fs.readFileSync;
  const cpuCount = deps.cpuCount ?? os.cpus().length;
  const fallback = Math.max(1, cpuCount);

  // cgroup v2: "<quota> <period>", ou "max <period>" quando nao ha limite.
  const v2 = readTrimmed(readFile, CGROUP_V2_CPU_MAX);
  if (v2 !== null) {
    const [quota, period] = v2.split(/\s+/);
    if (quota === 'max') return fallback;
    return quotaToCpus(quota, period) ?? fallback;
  }

  // cgroup v1: quota -1 significa sem limite.
  const quota = readTrimmed(readFile, CGROUP_V1_QUOTA);
  const period = readTrimmed(readFile, CGROUP_V1_PERIOD);
  if (quota !== null && period !== null) {
    return quotaToCpus(quota, period) ?? fallback;
  }

  return fallback;
}

/**
 * Workers de teste: reserva uma CPU para o processo principal do runner.
 *
 * @param {{ readFile?: typeof fs.readFileSync, cpuCount?: number }} [deps]
 * @returns {number} sempre >= 1
 */
export function maxWorkers(deps = {}) {
  return Math.max(1, detectCpuLimit(deps) - 1);
}
