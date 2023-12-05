import { ConnectionData } from './common/connection-data';
import { AddMigrationInterface, GetMigrationTableInterface } from './common/interfaces';
import { DatabaseIngotInterface } from '@myroslavshymon/orm/orm/core';

export interface DatabaseStrategy {
	client: any;

	connect(dataToConnect: ConnectionData): Promise<void>;

	createMigration(options: AddMigrationInterface): Promise<void>;

	getCurrentDatabaseIngot(options: GetMigrationTableInterface): Promise<DatabaseIngotInterface>;

	query(sql: string): Promise<any>;
}
