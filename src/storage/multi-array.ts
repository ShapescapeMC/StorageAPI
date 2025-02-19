import { ExtendedStorage, SubIndex } from "./extended-storage";

/**
 * MultiArray is a class that allows to interact with an ordered array stored in the ExtendedStorage.
 */
export class MultiArray {
	private readonly key: string;
	private readonly storage: ExtendedStorage;
	private readonly index: number;
	private readonly subIndex: SubIndex;

	constructor(
		key: string,
		storage: ExtendedStorage,
		index: number,
		subIndex: SubIndex,
	) {
		this.key = key;
		this.storage = storage;
		this.index = index;
		this.subIndex = subIndex;
	}

	/**
	 * Gets the value of the current element.
	 */
	getValue(): any {
		if (this.isRemoved()) return undefined;
		return this.storage.get(this.key + ".ar." + this.index);
	}

	/**
	 * Sets the value of the current element.
	 * @param value The value to set.
	 */
	setValue(value: any): void {
		if (this.isRemoved())
			throw new Error("Cannot set value of removed MultiArray element.");
		this.storage.set(this.key + ".ar." + this.index, value);
	}

	/**
	 * Gets the next element in the array.
	 * Returns `undefined` if the current element is the last one.
	 */
	getNext(): MultiArray | null {
		if (this.subIndex.next === null) return null;
		const subIndex = this.storage.getSubIndex(this.key, this.subIndex.next);
		if (!subIndex) return null;
		return new MultiArray(this.key, this.storage, this.subIndex.next, subIndex);
	}

	/**
	 * Gets the previous element in the array.
	 * Returns `null` if the current element is the first one.
	 */
	getPrev(): MultiArray | null {
		if (this.subIndex.prev === null) return null;
		const subIndex = this.storage.getSubIndex(this.key, this.subIndex.prev);
		if (!subIndex) return null;
		return new MultiArray(this.key, this.storage, this.subIndex.prev, subIndex);
	}

	/**
	 * Checks whether the current element has been removed.
	 */
	isRemoved(): boolean {
		return this.storage.get(this.key + ".ar." + this.index) === undefined;
	}

	/**
	 * Removes the current element from the array.
	 */
	remove(): void {
		if (this.subIndex.prev !== null) {
			const prev = this.storage.get(this.key + ".ar." + this.subIndex.prev);
			prev.next = this.subIndex.next;
			this.storage.set(this.key + ".ar." + this.subIndex.prev, prev);
		}
		if (this.subIndex.next !== null) {
			const next = this.storage.get(this.key + ".ar." + this.subIndex.next);
			next.prev = this.subIndex.prev;
			this.storage.set(this.key + ".ar." + this.subIndex.next, next);
		}
		this.storage.drop(this.key + ".ar." + this.index);
	}

	/**
	 * Inserts a new element after the current element.
	 * @param value The value to insert.
	 */
	insertAfter(value: any): void {
		const index = this.storage.getArrayIndex(this.key);
		if (!index) throw new Error("Array index not found.");
		const newIndex = index.end + 1;
		const newSubIndex: SubIndex = {
			prev: this.index,
			next: this.subIndex.next,
		};
		this.subIndex.next = newIndex;
		this.storage.set(this.key + ".ar." + this.index, this.subIndex);
		this.storage.set(this.key + ".ar." + newIndex, newSubIndex);
		this.storage.set(this.key + ".ar." + newIndex, value);
	}

	/**
	 * Inserts a new element before the current element.
	 * @param value The value to insert.
	 */
	insertBefore(value: any): void {
		const index = this.storage.getArrayIndex(this.key);
		if (!index) throw new Error("Array index not found.");
		const newIndex = index.start - 1;
		const newSubIndex: SubIndex = {
			prev: this.subIndex.prev,
			next: this.index,
		};
		this.subIndex.prev = newIndex;
		this.storage.set(this.key + ".ar." + this.index, this.subIndex);
		this.storage.set(this.key + ".ar." + newIndex, newSubIndex);
		this.storage.set(this.key + ".ar." + newIndex, value);
	}
}
