import { DatabaseIngotInterface } from '@myroslavshymon/orm/orm/core';
import { AddMigrationInterface, ConnectionData, GetMigrationTableInterface } from '../common';

export interface DatabaseStrategy {
	client: any;

	connect(dataToConnect: ConnectionData): Promise<void>;

	createMigration(options: AddMigrationInterface): Promise<void>;

	getCurrentDatabaseIngot(options: GetMigrationTableInterface): Promise<DatabaseIngotInterface>;

	query(sql: string): Promise<any>;
}
