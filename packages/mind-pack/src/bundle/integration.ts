/**
 * Bundle integration for KB Labs Mind Pack
 */

import { spawn } from 'node:child_process';
import { promisify } from 'node:util';

const execAsync = promisify(spawn);

/**
 * Try to get bundle information via kb bundle command
 */
export async function getBundleInfo(
  product: string,
  timeoutMs: number = 1200
): Promise<string | null> {
  try {
    const { stdout } = await Promise.race([
      execAsync('kb', ['bundle', 'print', '--product', product, '--json'], { 
        stdio: 'pipe',
        timeout: timeoutMs 
      }) as Promise<{ stdout: string }>,
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Timeout')), timeoutMs)
      )
    ]) as { stdout: string };

    const bundleData = JSON.parse(stdout.toString());
    
    // Create 8-12 line summary
    const summary = [
      `# Bundle Information: ${product}`,
      '',
      `Config keys: ${Object.keys(bundleData.config || {}).length}`,
      `Profile: ${bundleData.profile?.name || 'default'}`,
      `Artifacts: ${Object.keys(bundleData.artifacts?.summary || {}).length} types`,
      `Policy: ${bundleData.policy?.bundle || 'permit-all'}`,
      '',
      'Configuration layers:',
      ...(bundleData.trace?.slice(0, 3).map((step: any) => `- ${step.layer}`) || [])
    ].join('\n');

    return summary;
  } catch (error: any) {
    // Fail-open: return null on any error
    return null;
  }
}
