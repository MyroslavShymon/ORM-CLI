import { MigrationsType } from '../types';

export interface MigrationManagerInterface {
	createMigration(migrationName: string | boolean): Promise<void>;

	migrationUp(migrationName: string): Promise<void>;

	migrationDown(migrationName: string): Promise<void>;

	migrate(direction: MigrationsType): Promise<void>;
}