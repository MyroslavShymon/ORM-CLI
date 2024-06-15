import { ColumnInterface } from '@myroslavshymon/orm/orm/core';

export interface ColumnOfDatabaseIngotInterface {
	id: string | undefined;
	name: string;
	columns: ColumnInterface[];
}