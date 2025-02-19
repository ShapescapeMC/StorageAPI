# ShapeStorageAPI

[![Publish](https://github.com/Shapescape-Software/ShapeScriptAPI/actions/workflows/publish.workflow.yml/badge.svg?branch=main)](https://github.com/Shapescape-Software/ShapeScriptAPI/actions/workflows/publish.workflow.yml)

## Installing

`npm install @shapescape-software/shapescriptapi` after setting up the GitHub Package Registry, check out the [dedicated Loop Page](https://shapescapeco.sharepoint.com/:fl:/g/contentstorage/CSP_3debc2cf-cfe0-42fa-a3c3-ed350bd33299/EacZlQOA3oNGiPMXDe5w6XMBIY6XAT06mqzNwsL-OSfJmA?e=jATjWv&nav=cz0lMkZjb250ZW50c3RvcmFnZSUyRkNTUF8zZGViYzJjZi1jZmUwLTQyZmEtYTNjMy1lZDM1MGJkMzMyOTkmZD1iJTIxejhMclBlRFAta0tqdy0wMUM5TXltVFI5YkIwUkJLdEpsU1lxY2UzZ1M0Z05UVE1xeU12RVFZMl9Ua3BLQXEzNyZmPTAxM1JBRTJVNUhER0tRSEFHNlFORElSNFlYQlhYSEIyTFQmYz0lMkYmYT1Mb29wQXBwJnA9JTQwZmx1aWR4JTJGbG9vcC1wYWdlLWNvbnRhaW5lciZ4PSU3QiUyMnclMjIlM0ElMjJUMFJUVUh4emFHRndaWE5qWVhCbFkyOHVjMmhoY21Wd2IybHVkQzVqYjIxOFlpRjZPRXh5VUdWRVVDMXJTMnAzTFRBeFF6bE5lVzFVVWpsaVFqQlNRa3QwU214VFdYRmpaVE5uVXpSblRsUlVUWEY1VFhaRlVWa3lYMVJyY0V0QmNUTTNmREF4TTFKQlJUSlZXazVVUzFKUlJEZERNbGMxUTFsR056UlZWRkJIVUUxQ1R6USUzRCUyMiUyQyUyMmklMjIlM0ElMjIyZTY2NDU5Mi01YmI3LTQwYTUtOGZiOS1hZTc1NmFhNzQ0ZTclMjIlN0Q%3D) for more information.

## Usage
### Dynamic Property Storage
The Storage class is a wrapper around a Minecraft Dynamic Storage (a storage that support dynamic properties), it allows you to store and retrieve data from the storage in a Redis-like way.

```typescript
const storage = new Storage(world)
storage.set("test", "test");
const value = storage.get("test");
const array = [1, 2, 3, 4, 5];
storage.set("array", array); // Store an array as a JSON Object
const arrayValue = storage.get("array");

// Store an array as a JSON Array - Optimal for small arrays
storage.rPush("array", 2);
storage.rPush("array", 3);
storage.rPush("array", 4);
storage.rPush("array", 5);
// Add an element to the beginning of the array
storage.lPush("array", 1);
// Final array: [1, 1, 2, 3, 4, 5, 2, 3, 4, 5]
```

### Dynamic Property Extended Storage
The Extended Storage is a version of the Storage that allows you to store more than 32 KiB of data for each value, and it also saves arrays as Linked Lists.

```typescript
const storage = new ExtendedStorage(world)
storage.set("test", "test");
const value = storage.get("test");
const array = [1, 2, 3, 4, 5];
storage.set("array", array); // Store an array as a JSON Object
const arrayValue = storage.get("array");

// Create a linked list - Optimal for large arrays
storage.rPush("linkedList", 1);
storage.rPush("linkedList", 2);
storage.rPush("linkedList", 3);
storage.rPush("linkedList", 4);
storage.rPush("linkedList", 5);
```

#### MultiArray
The MultiArray is a class that allows you to navigate and manipulate a Linked List.

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

## Usage with Similar Command Set
You can now use a set of commands similar to Redis:
```typescript
// Using PropertyStorage (or any derived storage)
const storage = new Storage(world);

// Store and fetch a key:
storage.store("test", "value");
const value = storage.fetch("test");

// Storing multiple keys:
storage.storeBulk({ key1: "value1", key2: "value2" });
const values = storage.fetchBulk(["key1", "key2"]);

// Removing a key:
storage.drop("test");

// Checking key existence and searching keys:
if (storage.keyExists("key1")) {
    const keys = storage.searchKeys("key");
}
```