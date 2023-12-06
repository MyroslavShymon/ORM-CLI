export interface UpdateMigrationStatusInterface {
	migrationTable: string;
	migrationTableSchema: string;
	migrationName: string,
	isUp: boolean
}