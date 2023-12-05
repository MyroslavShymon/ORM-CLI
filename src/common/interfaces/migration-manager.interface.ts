export interface MigrationManagerInterface {
	createMigration(migrationName: string | boolean): Promise<void>;
}