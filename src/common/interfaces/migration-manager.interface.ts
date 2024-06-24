export interface MigrationManagerInterface {
	createMigration(migrationName: string | boolean): Promise<void>;

	migrationUp(migrationName: string): Promise<void>;

	migrationDown(migrationName: string): Promise<void>;
}