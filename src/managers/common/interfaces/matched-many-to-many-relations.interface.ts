import { ManyToManyInterface } from '@myroslavshymon/orm/dist/orm/core';

export interface MatchedManyToManyRelationsInterface extends ManyToManyInterface {
	referencedTable: string;
	futureTableName: string;
}