import { ManyToManyInterface } from '@myroslavshymon/orm/orm/core';

export interface MatchedManyToManyRelationsInterface extends ManyToManyInterface {
	futureTableName: string;
}