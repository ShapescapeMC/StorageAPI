import {
	ContainerSlot,
	Entity,
	ItemStack,
	Vector3,
	World,
} from "@minecraft/server";

/**
 * Abstraction for a persistent Minecraft storage allowing for easy storage of data.
 */
export class PropertyStorage {
	/**
	 * Maximum allowed byte size for a value.
	 * @private
	 */
	protected readonly MAX_BYTE_SIZE = 32 * 1024 - 1;

	/**
	 * The underlying storage backend.
	 */
	private readonly storage:
		| Entity
		| World
		| ItemStack
		| ContainerSlot
		| DynamicStorage;

	/**
	 * Optional prefix for keys.
	 */
	protected readonly prefix: string;

	/**
	 * Creates a new PropertyStorage instance.
	 * @param storage - The dynamic storage object.
	 * @param prefix - Optional key prefix.
	 */
	constructor(
		storage: Entity | World | ItemStack | ContainerSlot | DynamicStorage,
		prefix?: string,
	) {
		this.storage = storage;
		this.prefix = prefix ?? "";
	}

	/**
	 * Sets a value in the storage.
	 * @param key - The key to set.
	 * @param value - The value to set, can be any JSON-serializable value.
	 * @param options - Optional serialization options.
	 */
	set(key: string, value: any, options?: SerializationOptions): void {
		key = this.prefix + key;
		value = this.serialize(value, options);
		this.getStorage().setDynamicProperty(key, value);
	}

	/**
	 * Removes a value from the storage.
	 * @param key - The key to remove.
	 */
	drop(key: string): void {
		key = this.prefix + key;
		this.getStorage().setDynamicProperty(key);
	}

	/**
	 * Clears all values from the storage.
	 * This method deletes keys matching the pattern in the main storage.
	 * If includeSubStorages is true, it also recursively clears values within each sub-storage,
	 * leaving the sub-storage container itself intact.
	 * @param pattern - Pattern to match keys against. If omitted, defaults to the storage prefix.
	 * @param includeSubStorages - Whether to clear values in sub-storages.
	 */
	clear(pattern?: string, includeSubStorages: boolean = true): void {
		// Determine the effective pattern
		const effectivePattern = pattern ? this.prefix + pattern : this.prefix;
		const keys = this.getStorage().getDynamicPropertyIds();
		// Retrieve sub-storage identifiers (container keys)
		const subStorages: string[] = this.get("subStorages", false, []);

		// Clear keys in the main storage except those that exactly correspond to substorage containers
		for (const key of keys) {
			if (key.startsWith(effectivePattern)) {
				// Do not clear if the key exactly matches a substorage container key
				if (subStorages.includes(key)) continue;
				this.getStorage().setDynamicProperty(key);
			}
		}

		// If requested, clear values within each sub-storage recursively (without deleting the substorage container)
		if (includeSubStorages) {
			for (const sub of subStorages) {
				// Create sub-storage instance for each sub-storage key
				const subStore = this.getSubStorage(sub);
				// Clear all keys within the sub-storage; passing undefined pattern clears all keys inside.
				subStore.clear(undefined, false);
			}
		}
	}

	/**
	 * Gets a value from the storage.
	 * @param key - The key to get.
	 * @param deserialize - Whether to deserialize the value.
	 * @param defaultValue - A default value returned if the key does not exist.
	 * @param options - Optional deserialization options.
	 * @returns The stored value or the default value.
	 */
	get(
		key: string,
		deserialize: boolean = true,
		defaultValue?: any,
		options?: DeserializationOptions,
	): any {
		key = this.prefix + key;
		const value = this.getStorage().getDynamicProperty(key);
		if (value === undefined) return defaultValue;
		if (typeof value === "string" && deserialize)
			return this.deserialize(value, options);
		return value;
	}

	/**
	 * Gets all values from the storage.
	 * @param pattern - Pattern to match keys against.
	 * @param deserialize - Whether to deserialize the returned values.
	 * @param options - Optional deserialization options.
	 * @returns Array of key-value pair objects.
	 */
	getAll(
		pattern?: string,
		deserialize?: boolean,
		options?: DeserializationOptions,
	): Record<string, any>[] {
		const properties: Record<string, any>[] = [];
		const keys = this.getStorage().getDynamicPropertyIds();
		if (!pattern) pattern = this.prefix;
		else pattern = this.prefix + pattern;
		for (let key of keys) {
			if (key.startsWith(pattern)) {
				key = key.slice(this.prefix.length);
				const value = this.getStorage().getDynamicProperty(key);
				if (typeof value === "string" && deserialize)
					properties.push({ [key]: this.deserialize(value, options) });
				else properties.push({ [key]: value });
			}
		}
		return properties;
	}

	/**
	 * Pushes a value to the end of an array stored in the storage.
	 * @param key - The key of the array.
	 * @param value - The value to push.
	 */
	rPush(key: string, value: any): void {
		const property = this.assertArray(key, true);
		property.push(value);
		this.set(key, property);
	}

	/**
	 * Pushes a value to the beginning of an array stored in the storage.
	 * @param key - The key of the array.
	 * @param value - The value to push.
	 */
	lPush(key: string, value: any): void {
		const property = this.assertArray(key, true);
		property.unshift(value);
		this.set(key, property);
	}

	/**
	 * Pops a value from the end of an array.
	 * @param key - The key of the array.
	 * @returns The value popped.
	 */
	rPop(key: string): any {
		const property = this.assertArray(key);
		const value = property.pop();
		this.set(key, property);
		return value;
	}

	/**
	 * Pops a value from the beginning of an array.
	 * @param key - The key of the array.
	 * @returns The value popped.
	 */
	lPop(key: string): any {
		const property = this.assertArray(key);
		const value = property.shift();
		this.set(key, property);
		return value;
	}

	/**
	 * Calculates the byte size of a stored value.
	 * @param key - The key of the value.
	 * @returns The byte length.
	 */
	getByteSize(key: string): number {
		return this.encodeValue(this.get(key, false)).byteLength;
	}

	/**
	 * Retrieves the underlying storage object.
	 * @returns The dynamic storage.
	 */
	getStorage(): DynamicStorage {
		return this.storage;
	}

	/**
	 * Builds a sub-storage prefix based on a given identifier.
	 * @param prefix - The sub-storage identifier.
	 * @returns The full prefix.
	 */
	protected getSubStoragePrefix(prefix: string): string {
		return this.prefix + "_" + prefix + "_";
	}

	/**
	 * Registers a sub-storage.
	 * @param prefix - The sub-storage identifier.
	 */
	protected registerSubStorage(prefix: string): void {
		const subStorages = this.get("subStorages", true, []);
		if (!subStorages.includes(prefix)) {
			subStorages.push(prefix);
			this.set("subStorages", subStorages);
		}
	}

	/**
	 * Retrieves a sub-storage.
	 * @param prefix - The sub-storage identifier.
	 * @returns A new PropertyStorage instance with the updated prefix.
	 */
	getSubStorage(prefix: string) {
		this.registerSubStorage(prefix);
		return new PropertyStorage(this.storage, this.getSubStoragePrefix(prefix));
	}

	/**
	 * Encodes a value to a Uint8Array.
	 * @param value - The value to encode.
	 * @returns The encoded Uint8Array.
	 */
	protected encodeValue(value: string | number | boolean): Uint8Array {
		const binStr = decodeURIComponent(encodeURIComponent(value)),
			arr = new Uint8Array(binStr.length);
		const split = binStr.split("");
		for (let i = 0; i < split.length; i++) {
			arr[i] = split[i].charCodeAt(0);
		}
		return arr;
	}

	/**
	 * Serializes a value to a JSON string.
	 * @param data - The data to serialize.
	 * @param options - Optional serialization options.
	 * @returns The serialized string.
	 */
	protected serialize(data: any, options?: SerializationOptions): string {
		if (typeof data !== "string")
			return JSON.stringify(data, options?.replacer, options?.space);
		return data;
	}

	/**
	 * Deserializes a JSON string to a value.
	 * @param data - The string to deserialize.
	 * @param options - Optional deserialization options.
	 * @returns The deserialized value.
	 */
	protected deserialize(data: string, options?: DeserializationOptions): any {
		try {
			return JSON.parse(data, options?.reviver);
		} catch (ignored) {
			return data;
		}
	}

	/**
	 * Ensures that a storage key corresponds to an array.
	 * @param key - The key to verify.
	 * @param init - Whether to initialize the array if not exists.
	 * @returns The array stored at the key.
	 */
	protected assertArray(key: string, init: boolean = false): any[] {
		let property = this.get(key);
		if (!property) {
			property = [];
			if (init) this.set(key, []);
		} else if (!Array.isArray(property)) {
			throw new TypeError(`${key} is not an array`);
		}
		return property;
	}

	/**
	 * Stores multiple key-value pairs.
	 * @param pairs - An object with keys and corresponding values.
	 * @param options - Optional serialization options.
	 */
	storeBulk(pairs: Record<string, any>, options?: SerializationOptions): void {
		for (const key in pairs) {
			this.set(key, pairs[key], options);
		}
	}

	/**
	 * Retrieves multiple keys at once.
	 * @param keys - An array of keys.
	 * @param deserialize - Whether to deserialize the values.
	 * @param options - Optional deserialization options.
	 * @returns An array of values.
	 */
	fetchBulk(
		keys: string[],
		deserialize: boolean = true,
		options?: DeserializationOptions,
	): any[] {
		return keys.map((key) => this.get(key, deserialize, undefined, options));
	}

	/**
	 * Checks whether a key exists.
	 * @param key - The key to check.
	 * @returns True if exists, false otherwise.
	 */
	keyExists(key: string): boolean {
		return this.get(key) !== undefined;
	}

	/**
	 * Searches keys matching a given pattern.
	 * @param pattern - The pattern to match.
	 * @returns An array of matching keys (without the prefix).
	 */
	searchKeys(pattern?: string): string[] {
		const allKeys = this.getStorage().getDynamicPropertyIds();
		if (!pattern) return allKeys.map((k) => k.substring(this.prefix.length));
		return allKeys
			.filter((k) => k.startsWith(this.prefix + pattern))
			.map((k) => k.substring(this.prefix.length));
	}
}

/**
 * Serialization options for JSON.stringify.
 * @interface
 */
export interface SerializationOptions {
	/**
	 * A function that alters the behavior of the stringification process.
	 */
	replacer?: (this: any, key: string, value: any) => any;
	/**
	 * A string or number that indicates the indentation of nested structures.
	 */
	space?: string | number;
}

/**
 * Deserialization options for JSON.parse.
 * @interface
 */
export interface DeserializationOptions {
	/**
	 * A function that transforms the parsed value.
	 */
	reviver?: (this: any, key: string, value: any) => any;
}

/**
 * Interface representing the dynamic storage backend.
 * @interface
 */
export interface DynamicStorage {
	/**
	 * Retrieves the list of dynamic property identifiers.
	 * @returns An array of key strings.
	 */
	getDynamicPropertyIds(): string[];

	/**
	 * Retrieves a dynamic property by key.
	 * @param key - The property key.
	 * @returns The property value, if exists.
	 */
	getDynamicProperty(
		key: string,
	): undefined | string | number | boolean | Vector3;

	/**
	 * Clears all dynamic properties.
	 */
	clearDynamicProperties(): void;

	/**
	 * Sets a dynamic property.
	 * @param identifier - The unique key.
	 * @param value - Optional value to set.
	 */
	setDynamicProperty(identifier: string, value?: any): void;

	/**
	 * Retrieves the total byte count for dynamic properties.
	 * @returns The total byte count.
	 */
	getDynamicPropertyTotalByteCount(): number;
}
