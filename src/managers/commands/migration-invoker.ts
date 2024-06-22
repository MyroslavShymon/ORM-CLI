import { MigrationCommandInterface, MigrationInvokerInterface } from './interfaces';

export class MigrationInvoker implements MigrationInvokerInterface {
	private _history: MigrationCommandInterface[] = [];

	public async executeCommand(command: MigrationCommandInterface): Promise<string> {
		this._history.push(command);
		return await command.execute();
	}

	public async undoCommand(): Promise<string> {
		const command = this._history.pop();
		return command ? await command.undo() : '';
	}
}