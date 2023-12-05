import { DatabaseIngotInterface } from '@myroslavshymon/orm/orm/core';
import { DatabaseStrategy } from './database-strategy.interface';
import { AddMigrationInterface, ConnectionData, DatabaseContextInterface, GetMigrationTableInterface } from '../common';

export class DatabaseContext implements DatabaseContextInterface {
	private databaseStrategy: DatabaseStrategy;

	constructor(strategy: DatabaseStrategy) {
		this.databaseStrategy = strategy;
	}

	async connect(dataToConnect: ConnectionData): Promise<void> {
		try {
			await this.databaseStrategy.connect(dataToConnect);
		} catch (error) {
			console.log(`Database connection error`);
			throw error;
		}
	}

	async createMigration(options: AddMigrationInterface): Promise<void> {
		try {
			await this.databaseStrategy.createMigration(options);
		} catch (error) {
			console.log(`Error while adding migration`);
			throw error;
		}
	}

	async getCurrentDatabaseIngot(options: GetMigrationTableInterface): Promise<DatabaseIngotInterface> {
		try {
			return this.databaseStrategy.getCurrentDatabaseIngot(options);
		} catch (error) {
			console.log(`Error while getting current database ingot`);
			throw error;
		}
	}

	async query(sql: string): Promise<any> {
		try {
			return this.databaseStrategy.query(sql);
		} catch (error) {
			console.log(`An error occurred when querying the database`);
			throw error;
		}
	}
}
