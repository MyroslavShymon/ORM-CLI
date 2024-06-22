export interface OperationInterface {
	executeOperation(): Promise<string>;

	undoOperation(): Promise<string>;
}