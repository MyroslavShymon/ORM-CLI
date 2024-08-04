import { DatabaseIngotInterface } from '@myroslavshymon/orm/orm/core';
import { DatabasesTypes } from '@myroslavshymon/orm';

export interface UpdateMigrationIngotInterface<DT extends DatabasesTypes> {
	migrationName: string;
	ingot?: DatabaseIngotInterface<DT>;
	sql?: string;
	migrationTable?: string;
	migrationTableSchema?: string;
}