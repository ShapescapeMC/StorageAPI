import {
	DeserializationOptions,
	SerializationOptions,
	PropertyStorage,
} from "./property-storage";
import { MultiArray } from "./multi-array";

/**
 * ExtendedStorage is a Storage that allows to store more than 32KiB of data in each key.
 */
export class ExtendedStorage extends PropertyStorage {
	private init = false;
	/**
	 * Checks whether the storage is an ExtendedStorage.
	 * @param storage The storage to use.
	 */
	static isExtendedStorage(storage: PropertyStorage): boolean {
		return storage.get("shape_extended_storage");
	}

	/**
	 * @hidden
	 * @private
	 */
	private initStorage() {
		super.set("shape_extended_storage", true);
		this.init = true;
	}

	/**
	 * Sets the index of a value.
	 * @param key The key of the value.
	 * @param index The index to set.
	 */
	setIndex(key: string, index: Index | undefined): void {
		super.set(key + ".index", index);
		if (!this.init) this.initStorage();
	}

	/**
	 * Gets the index of a value.
	 * @param key The key of the value.
	 */
	getIndex(key: string): Index | undefined {
		const value = super.get(key + ".index");
		if (value) {
			if (!value.max) throw new TypeError(`Key ${key} is not an index`);
			return value as Index;
		}
		return undefined;
	}

	/**
	 * Sets the index of an array.
	 * @param key The key of the array.
	 * @param index The index to set.
	 */
	setArrayIndex(key: string, index: ArrayIndex | undefined): void {
		super.set(key, index);
		if (!this.init) this.initStorage();
	}

	/**
	 * Gets the index of an array.
	 * @param key The key of the array.
	 */
	getArrayIndex(key: string): ArrayIndex | undefined {
		const value = super.get(key + ".index");
		if (value) {
			if (!value.start) throw new TypeError(`Key ${key} is not an array index`);
			return value as ArrayIndex;
		}
		return undefined;
	}

	/**
	 * Sets a value in the storage.
	 * @param key The key of the value.
	 * @param value The value to set.
	 * @param options The serialization options to use. Default is `undefined`.
	 */
	set(key: string, value: any, options?: SerializationOptions): void {
		let index = this.getIndex(key);
		if (index || !value) {
			this.drop(key);
		}
		if (!value) return;

		if (/\.\d+$/.test(key)) {
			return super.set(key, value);
		}

		const serializedValue = this.serialize(value, options);
		const chunks = this.splitValueIntoChunks(serializedValue);
		index = { max: chunks.length } as Index;
		this.setIndex(key, index);
		for (let i = 0; i < chunks.length; i++) {
			super.set(key + "." + i, chunks[i]);
		}
	}

	/**
	 * Gets a value from the storage.
	 * @param key The key of the value.
	 * @param deserialize Whether to deserialize the value. Default is `true`.
	 * @param defaultValue
	 * @param options The deserialization options to use. Default is `undefined`.
	 */
	get(
		key: string,
		deserialize: boolean = true,
		defaultValue?: any,
		options?: DeserializationOptions,
	): any {
		if (/\.\d+$/.test(key)) {
			return super.get(key, deserialize, defaultValue, options);
		}
		const index = this.getIndex(key);
		if (!index) return defaultValue;

		let result = "";
		for (let i = 0; i < index.max; i++) {
			const chunk = super.get(key + "." + i, false);
			if (!chunk) return defaultValue;
			result += chunk;
		}

		if (result === "") return defaultValue;
		if (deserialize) {
			return this.deserialize(result, options);
		}
		return result;
	}

	/**
	 * Removes a value from the storage.
	 * @param key The key of the value.
	 */
	drop(key: string): void {
		if (this.isArray(key)) {
			const arrayIndex = this.getArrayIndex(key);
			if (!arrayIndex) return;
			let i: number | null = arrayIndex.start;
			while (i != null) {
				super.drop(key + ".ar." + i);
				i = arrayIndex[i].next;
			}
			this.setArrayIndex(key, undefined);
		} else {
			const index = this.getIndex(key);
			if (!index) {
				super.drop(key);
				return;
			}

			for (let i = 0; i < index.max; i++) {
				super.drop(key + "." + i);
			}
			this.setIndex(key, undefined);
		}
	}

	/**
	 * Returns a MultiArray object that allows to navigate from the start and manipulate an array stored in the storage.
	 * @param key The key of the array.
	 */
	getMultiArray(key: string): MultiArray {
		const arrayIndex = this.getArrayIndex(key);
		if (!arrayIndex) throw new TypeError(`Key ${key} is not an array`);
		if (this.isArrayEmpty(key))
			throw new TypeError(`Key ${key} is an empty array`);
		const subIndex = arrayIndex[arrayIndex.start];
		return new MultiArray(key, this, arrayIndex.start, subIndex);
	}

	/**
	 * Appends a value to the end of the array.
	 * @param key The key of the array.
	 * @param value The value to append.
	 * @param options The serialization options to use. Default is `undefined`.
	 */
	rPush(key: string, value: any, options?: SerializationOptions): void {
		const index = this.assertMultiArray(key, true);

		if (index.end === index.start) {
			index[index.end] = { prev: null, next: null };
		} else {
			index[index.end].next = index.end + 1;
			index[index.end + 1] = { prev: index.end, next: null };
		}

		index.end++;
		super.set(key + ".ar." + index.end, value, options);
		this.setArrayIndex(key, index);
	}

	/**
	 * Prepends a value to the start of the array.
	 * @param key The key of the array.
	 * @param value The value to prepend.
	 * @param options The serialization options to use. Default is `undefined`.
	 */
	lPush(key: string, value: any, options?: SerializationOptions): void {
		const index = this.assertMultiArray(key, true);

		if (index.end === index.start) {
			index[index.start] = { prev: null, next: null };
		} else {
			index[index.start].prev = index.start - 1;
			index[index.start - 1] = { prev: null, next: index.start };
		}

		index.start--;
		super.set(key + ".ar." + index.start, value, options);
		this.setArrayIndex(key, index);
	}

	/**
	 * Removes the last element from the array and returns it.
	 * @param key The key of the array.
	 * @param deserialize Whether to deserialize the value. Default is `true`.
	 * @param options The deserialization options to use. Default is `undefined`.
	 */
	rPop(
		key: string,
		deserialize?: boolean,
		options?: DeserializationOptions,
	): any {
		const index = this.assertMultiArray(key);
		if (index.end === index.start) return undefined;

		const value = super.get(key + ".ar." + index.end, deserialize, options);
		index.end--;
		this.setArrayIndex(key, index);
		return value;
	}

	/**
	 * Removes the first element from the array and returns it.
	 * @param key The key of the array.
	 * @param deserialize Whether to deserialize the value. Default is `true`.
	 * @param options The deserialization options to use. Default is `undefined`.
	 */
	lPop(
		key: string,
		deserialize?: boolean,
		options?: DeserializationOptions,
	): any {
		const index = this.assertMultiArray(key);
		if (index.end === index.start) return undefined;

		const value = super.get(key + ".ar." + index.start, deserialize, options);
		index.start++;
		this.setArrayIndex(key, index);
		return value;
	}

	/**
	 * Checks whether the array is empty.
	 * @param key The key of the array.
	 */
	isArrayEmpty(key: string): boolean {
		const index = this.getArrayIndex(key);
		return !index || index.end === index.start;
	}

	/**
	 * Checks whether the value is an array.
	 * @param key The key of the value.
	 */
	isArray(key: string): boolean {
		const index = this.getArrayIndex(key);
		return !!index && !this.isArrayEmpty(key);
	}

	/**
	 * Gets the length of the array.
	 * @param key The key of the array.
	 */
	getArrayLength(key: string): number {
		if (!this.isArray(key)) return 0;
		const index = this.getArrayIndex(key);
		if (!index) return 0;
		let multiArray: MultiArray | null = this.getMultiArray(key);
		let length = 0;
		while (multiArray) {
			length++;
			multiArray = multiArray.getNext();
		}
		return length;
	}

	/**
	 * Gets the sub index of an element in the array.
	 * @param key The key of the array.
	 * @param index The index of the element.
	 */
	getSubIndex(key: string, index: number): SubIndex | undefined {
		const arrayIndex = this.getArrayIndex(key);
		if (!arrayIndex) return undefined;
		return arrayIndex[index];
	}

	/**
	 * @internal
	 * Asserts that the key is an array and returns its index.
	 * @param key The key of the array.
	 * @param create Whether to create the index in the persistent storage if it doesn't exist. Default is `false`.
	 */
	assertMultiArray(key: string, create: boolean = false): ArrayIndex {
		let index = this.getArrayIndex(key);
		if (!index) {
			index = { start: 0, end: 0 } as ArrayIndex;
		}
		if (index.end === index.start) {
			index.start = 0;
			index.end = 0;
		}
		if (create) {
			this.setArrayIndex(key, index);
		}
		return index;
	}

	/**
	 * @internal
	 * Splits a value into chunks of a specified size.
	 * @param input The value to split.
	 * @param chunkSize The size of each chunk. Default is 32KiB.
	 */
	splitValueIntoChunks(
		input: string | number | boolean,
		chunkSize: number = this.MAX_BYTE_SIZE,
	): string[] {
		const encodedInput = this.encodeValue(input);

		const result: string[] = [];
		let offset = 0;

		while (offset < encodedInput.length) {
			// Determine the size of the current chunk
			const size = Math.min(chunkSize, encodedInput.length - offset);

			// Create a chunk as a subarray of the original encoded input
			const chunk = encodedInput.subarray(offset, offset + size);

			// Convert the chunk back to a string
			const decoder = new TextDecoder();
			result.push(decoder.decode(chunk));

			// Update the offset for the next iteration
			offset += size;
		}

		return result;
	}

	getSubStorage(prefix: string) {
		this.registerSubStorage(prefix);
		return new ExtendedStorage(
			this.getStorage(),
			this.getSubStoragePrefix(prefix),
		);
	}
}

/**
 * Index is a structure that stores the number of chunks in a value.
 */
export interface Index {
	max: number;
}

/**
 * ArrayIndex is a structure that stores the start and end of an array, as well as the previous and next indexes of each element.
 */
export interface ArrayIndex {
	start: number;
	end: number;
	[key: number]: SubIndex;
}

export interface SubIndex {
	prev: number | null;
	next: number | null;
}
