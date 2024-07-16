import {
	ColumnInterface,
	ComputedColumnInterface,
	PrimaryGeneratedColumnInterface
} from '@myroslavshymon/orm/orm/core';
import { DatabasesTypes } from '@myroslavshymon/orm';

export interface CompressedTableIngotInterface<DT extends DatabasesTypes> {
	id: string | undefined;
	name: string;
	columns: ColumnInterface<DT>[];
	computedColumns: ComputedColumnInterface<DT>[];
	primaryColumn?: PrimaryGeneratedColumnInterface<DT>;
}