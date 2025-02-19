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
	protected readonly MAX_BYTE_SIZE = 32 * 1024 - 1;

	private readonly storage:
		| Entity
		| World
		| ItemStack
		| ContainerSlot
		| DynamicStorage;
	protected readonly prefix: string;

	constructor(
		storage: Entity | World | ItemStack | ContainerSlot | DynamicStorage,
		prefix?: string,
	) {
		this.storage = storage;
		this.prefix = prefix ?? "";
	}

	/**
	 * Sets a value in the storage.
	 * @param key The key to set.
	 * @param value The value to set. This can be any JSON-serializable value.
	 * @param options Serialization options.
	 */
	set(key: string, value: any, options?: SerializationOptions): void {
		key = this.prefix + key;
		value = this.serialize(value, options);
		this.getStorage().setDynamicProperty(key, value);
	}

	/**
	 * Removes a value from the storage.
	 * @param key The key to remove.
	 */
	drop(key: string): void {
		key = this.prefix + key;
		this.getStorage().setDynamicProperty(key);
	}

	/**
	 * Clears all values from the storage.
	 * @param pattern A pattern to match keys against. If provided, only keys that start with the pattern will be cleared.
	 * @param includeSubStorages Whether to clear sub-storages as well.
	 */
	clear(pattern?: string, includeSubStorages: boolean = true): void {
		if (this.prefix.length > 0) {
			if (!pattern || pattern == "") pattern = this.prefix;
			else pattern = this.prefix + pattern;
			const keys = this.getStorage().getDynamicPropertyIds();
			const subStorages = this.get("subStorages", false, []);
			for (const key of keys) {
				if (
					key.startsWith(pattern) &&
					(!subStorages.includes(key) || includeSubStorages)
				) {
					this.getStorage().setDynamicProperty(key);
				}
			}
		} else {
			this.getStorage().clearDynamicProperties();
		}
	}

	/**
	 * Gets a value from the storage.
	 * @param key The key to get.
	 * @param deserialize Whether to deserialize the value.
	 * @param defaultValue The default value to return if the key does not exist.
	 * @param options Deserialization options.
	 * @returns The value if it exists, or `undefined` if it does not.
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
	 * Gets all values from the storage. Could lead to performance issues if the storage is large.
	 * @param pattern A pattern to match keys against. If provided, only keys that match the pattern will be returned.
	 * @param deserialize Whether to deserialize the values.
	 * @param options Deserialization options.
	 * @returns An array of key-value pairs.
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
	 * Pushes a value to the end of an array in the storage.
	 * @param key The key of the array.
	 * @param value The value to push.
	 */
	rPush(key: string, value: any): void {
		const property = this.assertArray(key, true);
		property.push(value);
		this.set(key, property);
	}

	/**
	 * Pushes a value to the start of an array in the storage.
	 * @param key The key of the array.
	 * @param value The value to push.
	 */
	lPush(key: string, value: any): void {
		const property = this.assertArray(key, true);
		property.unshift(value);
		this.set(key, property);
	}

	/**
	 * Pops a value from the end of an array in the storage.
	 * @param key The key of the array.
	 * @returns The value that was popped.
	 */
	rPop(key: string): any {
		const property = this.assertArray(key);
		const value = property.pop();
		this.set(key, property);
		return value;
	}

	/**
	 * Pops a value from the start of an array in the storage.
	 * @param key The key of the array.
	 * @returns The value that was popped.
	 */
	lPop(key: string): any {
		const property = this.assertArray(key);
		const value = property.shift();
		this.set(key, property);
		return value;
	}

	/**
	 * Check the byte size of a value in the storage.
	 * @param key The key of the value.
	 */
	getByteSize(key: string): number {
		return this.encodeValue(this.get(key, false)).byteLength;
	}

	/**
	 * Get the storage object.
	 */
	getStorage(): DynamicStorage {
		return this.storage;
	}

	protected getSubStoragePrefix(prefix: string): string {
		return this.prefix + "_" + prefix + "_";
	}

	protected registerSubStorage(prefix: string): void {
		const subStorages = this.get("subStorages", false, []);
		if (!subStorages.includes(prefix)) {
			subStorages.push(prefix);
			this.set("subStorages", subStorages);
		}
	}

	getSubStorage(prefix: string) {
		this.registerSubStorage(prefix);
		return new PropertyStorage(this.storage, this.getSubStoragePrefix(prefix));
	}

	/**
	 * @internal
	 * Encodes a value to a Uint8Array.
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
	 * @internal
	 * Serializes a value to a string.
	 */
	protected serialize(data: any, options?: SerializationOptions): string {
		if (typeof data !== "string")
			return JSON.stringify(data, options?.replacer, options?.space);
		return data;
	}

	/**
	 * @internal
	 * Deserializes a string to a value.
	 */
	protected deserialize(data: string, options?: DeserializationOptions): any {
		try {
			return JSON.parse(data, options?.reviver);
		} catch (ignored) {
			return data;
		}
	}

	/**
	 * @internal
	 * Asserts that a property is an array.
	 * @param key The key of the property.
	 * @param init Whether to initialize the property if it does not exist.
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

	// Alias for setting multiple key-value pairs, named "storeBulk"
	storeBulk(pairs: Record<string, any>, options?: SerializationOptions): void {
		for (const key in pairs) {
			this.set(key, pairs[key], options);
		}
	}

	// Alias for getting multiple keys, named "fetchBulk"
	fetchBulk(
		keys: string[],
		deserialize: boolean = true,
		options?: DeserializationOptions,
	): any[] {
		return keys.map((key) => this.get(key, deserialize, undefined, options));
	}

	// Check if a key exists, named "keyExists"
	keyExists(key: string): boolean {
		return this.get(key) !== undefined;
	}

	// Retrieve keys matching a pattern, named "searchKeys"
	searchKeys(pattern?: string): string[] {
		const allKeys = this.getStorage().getDynamicPropertyIds();
		if (!pattern) return allKeys.map((k) => k.substring(this.prefix.length));
		return allKeys
			.filter((k) => k.startsWith(this.prefix + pattern))
			.map((k) => k.substring(this.prefix.length));
	}
}

/**
 * Options for serialization using `JSON.stringify`.
 */
export interface SerializationOptions {
	replacer?: (this: any, key: string, value: any) => any;
	space?: string | number;
}

/**
 * Options for deserialization using `JSON.parse`.
 */
export interface DeserializationOptions {
	reviver?: (this: any, key: string, value: any) => any;
}

/** @hidden */
export interface DynamicStorage {
	getDynamicPropertyIds(): string[];

	getDynamicProperty(
		key: string,
	): undefined | string | number | boolean | Vector3;

	clearDynamicProperties(): void;

	setDynamicProperty(identifier: string, value?: any): void;

	getDynamicPropertyTotalByteCount(): number;
}
