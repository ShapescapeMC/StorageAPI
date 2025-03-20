# Shapescape@Storage

![GitHub Actions Workflow Status](https://img.shields.io/github/actions/workflow/status/ShapescapeMC/StorageAPI/publish.workflow.yml?style=for-the-badge&label=Publish)

## Overview

**Shapescape@Storage** is a storage abstraction designed exclusively for Minecraft Bedrock. It leverages Minecraft's dynamic storage system, supporting both standard storage and extended storage capabilities that allow you to store values larger than 32KiB. The project offers a set of commands similar to Redis (with different naming) to manage stored data in an intuitive manner.

## Key Features

- **Minecraft Bedrock Exclusive**: Built to work only within the Minecraft Bedrock edition environment.
- **Dynamic Property Storage**: Uses Minecraft's dynamic storage to store and retrieve JSON-serializable data.
- **Extended Storage**: Automatically splits values into chunked segments if they exceed the Minecraft storage limit.
- **Array & Linked List Support**: Manage arrays as JSON objects or as linked lists using the `MultiArray` class.
- **Command Set Similar to Redis**: Offers instructions such as `store`, `fetch`, `storeBulk`, `fetchBulk`, `drop`, `keyExists`, and `searchKeys` for a familiar API style.
- **In-Memory Caching**: `CachedStorage` provides an optional cache to speed up repeated data access.

## Installation

You can install the package via npm. This project is part of the StorageAPI:
```bash
npm install @shapescape/storage
```


## Usage

### Dynamic Property Storage
The basic storage class is a wrapper around Minecraft’s dynamic storage:
```typescript
const storage = new Storage(world);
storage.set("test", "test");
const value = storage.get("test");

const array = [1, 2, 3, 4, 5];
storage.set("array", array); // Store an array as a JSON Object
const arrayValue = storage.get("array");

// For smaller arrays, you can also use push/pop operations:
storage.rPush("array", 2);
storage.rPush("array", 3);
storage.lPush("array", 1);
```

### Dynamic Property Extended Storage
ExtendedStorage allows you to store values larger than 32KiB by splitting the data into chunks:
```typescript
const storage = new ExtendedStorage(world);
storage.set("test", "test");
const value = storage.get("test");

const array = [1, 2, 3, 4, 5];
storage.set("array", array); // Store an array as a JSON Object

// Use linked list storage for larger arrays:
storage.rPush("linkedList", 1);
storage.rPush("linkedList", 2);
storage.rPush("linkedList", 3);
storage.rPush("linkedList", 4);
storage.rPush("linkedList", 5);
```

#### MultiArray
The `MultiArray` class lets you navigate and manipulate linked list arrays:
```typescript
storage.rPush("linkedList", 1);
storage.rPush("linkedList", 2);
storage.rPush("linkedList", 3);
storage.rPush("linkedList", 4);
storage.rPush("linkedList", 5);

let pointer: MultiArray | null = storage.getMultiArray("linkedList");
const firstValue = pointer.getValue(); // 1
pointer = pointer.getNext();
if (pointer) {
    const secondValue = pointer.getValue(); // 2
}
```

### Using the Similar Command Set
A Redis-like command set is available but with different naming:
```typescript
// Using PropertyStorage (or any derived storage)
const storage = new Storage(world);

// Store and fetch a key:
storage.store("test", "value");
const value = storage.fetch("test");

// Store multiple keys:
storage.storeBulk({ key1: "value1", key2: "value2" });
const values = storage.fetchBulk(["key1", "key2"]);

// Remove a key:
storage.drop("test");

// Check if a key exists and search for keys:
if (storage.keyExists("key1")) {
    const keys = storage.searchKeys("key");
}
```

## Minecraft Bedrock Dependency

**Important:** This project is designed to function **exclusively on Minecraft Bedrock Edition**. It relies on APIs provided by the Minecraft server environment which are available only in Bedrock. This means:
- The underlying storage methods (`getDynamicProperty`, `setDynamicProperty`, etc.) are implemented as part of Minecraft’s dynamic storage system.
- The project is not intended to be run or tested in environments other than Minecraft Bedrock.

Ensure that you deploy and run this API within an environment that supports these Minecraft-specific features.

## License

StoreAPI is licensed under the **[LGPL v3 License](LICENSE)**.

## Contributing

Contributions are welcome as long as they align with the goal of maintaining compatibility with Minecraft Bedrock. Before submitting a pull request, please ensure your changes are tested within the Minecraft Bedrock environment.

Happy crafting!
