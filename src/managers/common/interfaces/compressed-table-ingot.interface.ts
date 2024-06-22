import { ColumnInterface, PrimaryGeneratedColumnInterface } from '@myroslavshymon/orm/orm/core';

export interface CompressedTableIngotInterface {
	id: string | undefined;
	name: string;
	columns: ColumnInterface[];
	primaryColumn?: PrimaryGeneratedColumnInterface;
}