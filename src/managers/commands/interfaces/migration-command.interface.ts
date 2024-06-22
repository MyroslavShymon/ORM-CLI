export interface MigrationCommandInterface {
	execute(): Promise<string>;

	undo(): Promise<string>;
}