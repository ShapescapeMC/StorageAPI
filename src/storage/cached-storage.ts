import {
	DeserializationOptions,
	PropertyStorage,
	SerializationOptions,
} from "./property-storage";

/**
 * CachedStorage is a decoration of PropertyStorage that maintains an in-memory cache
 * to optimize repeated key access.
 */
export class CachedStorage extends PropertyStorage {
	/**
	 * In-memory cache storage.
	 */
	private readonly cache: Map<string, any> = new Map();

	/**
	 * Sets a value in the storage and caches it.
	 * @param key - The key to set.
	 * @param value - The value (must be JSON-serializable).
	 * @param options - Optional serialization options.
	 */
	set(key: string, value: any, options?: SerializationOptions): void {
		key = this.prefix + key;
		value = this.serialize(value, options);
		this.getStorage().setDynamicProperty(key, value);
		this.cache.set(key, value);
	}

	/**
	 * Removes a value from both the storage and the in-memory cache.
	 * @param key - The key to remove.
	 */
	remove(key: string): void {
		key = this.prefix + key;
		this.getStorage().setDynamicProperty(key);
		this.cache.delete(key);
	}

	/**
	 * Clears values from the storage and cache.
	 * This method deletes keys matching the pattern in the underlying storage by calling super.clear(),
	 * based on the includeSubStorages flag, and then removes matching entries from the in-memory cache.
	 * @param pattern - Pattern to match keys against. If omitted, defaults to the storage prefix.
	 * @param includeSubStorages - Whether to clear values in sub-storages.
	 */
	clear(pattern?: string, includeSubStorages: boolean = true): void {
		// Use the updated behavior from PropertyStorage to clear underlying storage.
		super.clear(pattern, includeSubStorages);
		// Determine effective pattern.
		const effectivePattern = pattern ? this.prefix + pattern : this.prefix;
		// Remove corresponding keys from the cache.
		for (const key of this.cache.keys()) {
			if (key.startsWith(effectivePattern)) {
				this.cache.delete(key);
			}
		}
	}

	/**
	 * Retrieves a value from the cache or storage.
	 * @param key - The key to fetch.
	 * @param deserialize - Whether to deserialize the value.
	 * @param defaultValue - The default value if the key does not exist.
	 * @param options - Optional deserialization options.
	 * @returns The fetched value.
	 */
	get(
		key: string,
		deserialize: boolean = true,
		defaultValue?: any,
		options?: DeserializationOptions,
	): any {
		key = this.prefix + key;
		let value = this.cache.get(key);
		if (value === undefined) value = this.getStorage().getDynamicProperty(key);
		if (value === undefined) return defaultValue;
		if (typeof value === "string" && deserialize)
			return this.deserialize(value, options);
		return value;
	}

	/**
	 * Retrieves a sub-storage instance with a given prefix.
	 * @param prefix - The sub-storage identifier.
	 * @returns A new CachedStorage instance.
	 */
	getSubStorage(prefix: string) {
		this.registerSubStorage(prefix);
		return new CachedStorage(
			this.getStorage(),
			this.getSubStoragePrefix(prefix),
		);
	}
}
