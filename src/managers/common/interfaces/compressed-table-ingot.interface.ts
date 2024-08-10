import { DatabasesTypes } from '@myroslavshymon/orm';
import {
	ColumnInterface,
	ComputedColumnInterface,
	PrimaryGeneratedColumnInterface
} from '@myroslavshymon/orm/dist/orm/core';

export interface CompressedTableIngotInterface<DT extends DatabasesTypes> {
	id: string | undefined;
	name: string;
	columns: ColumnInterface<DT>[];
	computedColumns: ComputedColumnInterface<DT>[];
	primaryColumn?: PrimaryGeneratedColumnInterface<DT>;
}