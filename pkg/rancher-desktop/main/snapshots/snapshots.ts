import { Snapshot, SpawnResult } from '@pkg/main/snapshots/types';
import { spawnFile } from '@pkg/utils/childProcess';
import Logging from '@pkg/utils/logging';
import { getRdctlPath } from '@pkg/utils/paths';

const console = Logging.snapshots;

function parseLines(line: string): string[] {
  return line?.split(/\r?\n/) || [];
}

class SnapshotsError {
  readonly isSnapshotError = true;
  message: string;

  constructor(args: string[], response: SpawnResult) {
    console.error(`snapshot error: command rdctl ${ args.join(' ') } => error ${ response.stdout }`);
    try {
      const value = JSON.parse(response.stdout);

      this.message = value?.error;
      if (!this.message) {
        console.error(`Empty or no error field found in the output`);
        this.message = 'Something went wrong with the `rdctl snapshot` command; the details are in the snapshots log file';
      }
    } catch (error) {
      const msg = 'Cannot parse error message from `rdctl snapshot` command';

      console.error(`${ msg }: ${ error }`);
      this.message = msg;
    }
  }
}

class SnapshotsImpl {
  private async rdctl(commandArgs: string[]): Promise<SpawnResult> {
    try {
      const rdctlPath = getRdctlPath();

      return await spawnFile(rdctlPath || '', commandArgs, { stdio: ['ignore', 'pipe', 'pipe'] });
    } catch (err: any) {
      return {
        stdout: err?.stdout ?? '', stderr: err?.stderr ?? '', error: err,
      };
    }
  }

  async list(): Promise<Snapshot[]> {
    const response = await this.rdctl(['snapshot', 'list', '--json']);

    if (response.error) {
      return [];
    }

    const data = parseLines(response.stdout).filter(line => line);

    return data.map(line => JSON.parse(line));
  }

  async create(snapshot: Snapshot) : Promise<void> {
    const args = [
      'snapshot',
      'create',
      snapshot.name,
      '--json',
    ];

    if (snapshot.description) {
      args.push('--description', snapshot.description);
    }

    const response = await this.rdctl(args);

    if (response.error) {
      throw new SnapshotsError(args, response);
    }
  }

  async restore(name: string) : Promise<void> {
    const args = ['snapshot', 'restore', name, '--json'];
    const response = await this.rdctl(args);

    if (response.error) {
      throw new SnapshotsError(args, response);
    }
  }

  async delete(name: string) : Promise<void> {
    const args = ['snapshot', 'delete', name, '--json'];
    const response = await this.rdctl(args);

    if (response.error) {
      throw new SnapshotsError(args, response);
    }
  }
}

export const Snapshots = new SnapshotsImpl();
