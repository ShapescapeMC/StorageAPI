import {
	DeserializationOptions,
	PropertyStorage,
	SerializationOptions,
} from "./property-storage";

export class CachedStorage extends PropertyStorage {
	private readonly cache: Map<string, any> = new Map();

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
		this.cache.set(key, value);
	}

	/**
	 * Removes a value from the storage.
	 * @param key The key to remove.
	 */
	remove(key: string): void {
		key = this.prefix + key;
		this.getStorage().setDynamicProperty(key);
		this.cache.delete(key);
	}

	/**
	 * Clears all values from the storage.
	 * @param pattern A pattern to match keys against. If provided, only keys that match the pattern will be cleared.
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
		let value = this.cache.get(key);
		if (value === undefined) value = this.getStorage().getDynamicProperty(key);
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
				let value = this.cache.get(key);
				if (!value) value = this.getStorage().getDynamicProperty(key);
				if (typeof value === "string" && deserialize)
					properties.push({ [key]: this.deserialize(value, options) });
				else properties.push({ [key]: value });
			}
		}
		return properties;
	}

	getSubStorage(prefix: string) {
		this.registerSubStorage(prefix);
		return new CachedStorage(
			this.getStorage(),
			this.getSubStoragePrefix(prefix),
		);
	}
}
