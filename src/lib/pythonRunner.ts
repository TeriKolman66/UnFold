import { invoke } from '@tauri-apps/api/core';

export interface PythonResult { stdout: string; stderr: string; exitCode: number | null; timedOut: boolean }

export async function runPython(code: string): Promise<PythonResult> {
  if (new TextEncoder().encode(code).length > 65_536) throw new Error('Python file is too large to run (64 KB limit).');
  if ('__TAURI_INTERNALS__' in window) return invoke<PythonResult>('run_python', { code });
  const response = await fetch('/__unfold/python', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code }),
  });
  const result = await response.json() as PythonResult & { error?: string };
  if (!response.ok) throw new Error(result.error ?? 'Could not run Python');
  return result;
}
