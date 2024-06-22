import { MigrationCommandInterface } from './migration-command.interface';

export interface MigrationInvokerInterface {
	executeCommand(command: MigrationCommandInterface): Promise<string>;

	undoCommand(): Promise<string>;
}