import { DatabasesTypes } from '@myroslavshymon/orm';
import { DatabaseIngotInterface } from '@myroslavshymon/orm/dist/orm/core';

export interface UpdateMigrationIngotInterface<DT extends DatabasesTypes> {
	migrationName: string;
	ingot?: DatabaseIngotInterface<DT>;
	sql?: string;
	migrationTable?: string;
	migrationTableSchema?: string;
}