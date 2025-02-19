import {
	DeserializationOptions,
	SerializationOptions,
	PropertyStorage,
} from "./property-storage";
import { MultiArray } from "./multi-array";

/**
 * ExtendedStorage is a storage class that allows storing values larger than 32KiB
 * by splitting them into chunks. It also supports array storage.
 */
export class ExtendedStorage extends PropertyStorage {
	/**
	 * Initialization flag.
	 * @private
	 */
	private init = false;
	/**
	 * Checks whether the provided storage is an ExtendedStorage.
	 * @param storage - The storage instance.
	 * @returns True if extended.
	 */
	static isExtendedStorage(storage: PropertyStorage): boolean {
		return storage.get("shape_extended_storage");
	}

	/**
	 * Initializes the extended storage.
	 * @private
	 */
	private initStorage(): void {
		super.set("shape_extended_storage", true);
		this.init = true;
	}

	/**
	 * Sets the index for a value.
	 * @param key - The key of the value.
	 * @param index - The index definition.
	 */
	setIndex(key: string, index: Index | undefined): void {
		super.set(key + ".index", index);
		if (!this.init) this.initStorage();
	}

	/**
	 * Gets the index for a value.
	 * @param key - The key of the value.
	 * @returns The index definition.
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
	 * Sets the array index structure.
	 * @param key - The key of the array.
	 * @param index - The array index definition.
	 */
	setArrayIndex(key: string, index: ArrayIndex | undefined): void {
		super.set(key, index);
		if (!this.init) this.initStorage();
	}

	/**
	 * Gets the array index structure.
	 * @param key - The key of the array.
	 * @returns The array index definition.
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
	 * Sets a value in extended storage. For values larger than 32KiB, splits into chunks.
	 * @param key - The key to set.
	 * @param value - The value to store.
	 * @param options - Optional serialization options.
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
	 * Gets a value from extended storage.
	 * @param key - The key to retrieve.
	 * @param deserialize - Whether to deserialize the string result.
	 * @param defaultValue - The default value if not found.
	 * @param options - Optional deserialization options.
	 * @returns The stored value.
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
	 * Removes a value from extended storage.
	 * @param key - The key to remove.
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
	 * Retrieves a MultiArray instance to navigate a linked list array.
	 * @param key - The key of the array.
	 * @returns The MultiArray instance.
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
	 * Appends a value to the end of an array.
	 * @param key - The array key.
	 * @param value - The value to append.
	 * @param options - Optional serialization options.
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
	 * Prepends a value to the start of an array.
	 * @param key - The array key.
	 * @param value - The value to prepend.
	 * @param options - Optional serialization options.
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
	 * Removes and returns the last element of an array.
	 * @param key - The array key.
	 * @param deserialize - Whether to deserialize the value.
	 * @param options - Optional deserialization options.
	 * @returns The removed element.
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
	 * Removes and returns the first element of an array.
	 * @param key - The array key.
	 * @param deserialize - Whether to deserialize the value.
	 * @param options - Optional deserialization options.
	 * @returns The removed element.
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
	 * Checks whether an array is empty.
	 * @param key - The array key.
	 * @returns True if empty.
	 */
	isArrayEmpty(key: string): boolean {
		const index = this.getArrayIndex(key);
		return !index || index.end === index.start;
	}

	/**
	 * Checks whether the value at a key is an array.
	 * @param key - The key to check.
	 * @returns True if an array.
	 */
	isArray(key: string): boolean {
		const index = this.getArrayIndex(key);
		return !!index && !this.isArrayEmpty(key);
	}

	/**
	 * Retrieves the length of an array.
	 * @param key - The array key.
	 * @returns The length.
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
	 * Gets the sub-index for an element in an array.
	 * @param key - The array key.
	 * @param index - The element index.
	 * @returns The SubIndex definition.
	 */
	getSubIndex(key: string, index: number): SubIndex | undefined {
		const arrayIndex = this.getArrayIndex(key);
		if (!arrayIndex) return undefined;
		return arrayIndex[index];
	}

	/**
	 * Asserts the key is an array and returns its index structure.
	 * @param key - The key to assert.
	 * @param create - Whether to create the index if it does not exist.
	 * @returns The ArrayIndex structure.
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
	 * Splits a value into chunks of a specified size.
	 * @param input - The value to split.
	 * @param chunkSize - The maximum size per chunk (default 32KiB).
	 * @returns An array of chunk strings.
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

	/**
	 * Retrieves a sub-storage with a given prefix.
	 * @param prefix - The sub-storage identifier.
	 * @returns A new ExtendedStorage instance with the sub-storage prefix.
	 */
	getSubStorage(prefix: string) {
		this.registerSubStorage(prefix);
		return new ExtendedStorage(
			this.getStorage(),
			this.getSubStoragePrefix(prefix),
		);
	}
}

/**
 * Structure representing the index of a stored value.
 * @interface
 */
export interface Index {
	/**
	 * Number of chunks the value was split into.
	 */
	max: number;
}

/**
 * Structure representing an array index.
 * @interface
 */
export interface ArrayIndex {
	/**
	 * Starting index of the array.
	 */
	start: number;
	/**
	 * Ending index of the array.
	 */
	end: number;
	/**
	 * Additional mapping for sub-indexes.
	 */
	[key: number]: SubIndex;
}

/**
 * Structure representing the relationships between array elements.
 * @interface
 */
export interface SubIndex {
	/**
	 * The previous element index or null.
	 */
	prev: number | null;
	/**
	 * The next element index or null.
	 */
	next: number | null;
}
