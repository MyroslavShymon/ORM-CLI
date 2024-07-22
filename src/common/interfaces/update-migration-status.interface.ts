export interface UpdateMigrationStatusInterface {
	migrationTable: string;
	migrationTableSchema: string;
	migrationName: string,
	databaseName: string
	isUp: boolean
}