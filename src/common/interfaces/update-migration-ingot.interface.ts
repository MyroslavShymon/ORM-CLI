import { DatabaseIngotInterface } from '@myroslavshymon/orm/orm/core';

export interface UpdateMigrationIngotInterface {
	ingot: DatabaseIngotInterface;
	migrationTable?: string;
	migrationTableSchema?: string;
	migrationName?: string;
}