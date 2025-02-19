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
	 * Clears values matching the given pattern from storage and cache.
	 * @param pattern - A pattern to match keys.
	 */
	clear(pattern?: string): void {
		if (this.prefix.length > 0) {
			if (!pattern) pattern = this.prefix;
			else pattern = this.prefix + pattern;
			const keys = this.getStorage().getDynamicPropertyIds();
			for (const key of keys) {
				if (key.startsWith(pattern)) {
					this.getStorage().setDynamicProperty(key);
					this.cache.delete(key);
				}
			}
		} else {
			this.getStorage().clearDynamicProperties();
			this.cache.clear();
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
	 * Retrieves all key-value pairs that match the specified pattern.
	 * @param pattern - A pattern to filter keys.
	 * @param deserialize - Whether to deserialize the values.
	 * @param options - Optional deserialization options.
	 * @returns An array of key-value pair objects.
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
				let value = this.cache.get(key);
				if (!value) value = this.getStorage().getDynamicProperty(key);
				if (typeof value === "string" && deserialize)
					properties.push({ [key]: this.deserialize(value, options) });
				else properties.push({ [key]: value });
			}
		}
		return properties;
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
