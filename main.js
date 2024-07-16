/**
 * I don't use 'defaultGetStore' function in my version!!!
 * Instead I directly pass a store as an argument.
 */



/**
 * IndexedDB uses an event-driven model for handling database operations, where we attach event listeners 
 * (such as 'onsuccess', 'onerror', etc.) to handle the outcome of an asynchronous request.
 * 
 * To handle async operations efficiently, we convert these operations into Promise-based operations.
 * This allows us to use modern JavaScript async patterns, making the code more readable and maintainable.
 * 
 * @param {IDBRequest} request - The IndexedDB request to be promisified.
 * @returns {Promise} A promise that resolves with the result of the request, or rejects with an error.
 */

export function promisifyRequest(request) {
  return new Promise((resolve, reject) => {
    /**
     * Resolve the promise on successful completion of the request.
     * @fires IDBRequest#onsuccess
     * @listens IDBRequest#onsuccess
     */
    request.oncomplete = request.onsuccess = () => resolve(request.result);
    /**
     * Reject the promise if the request is aborted or encounters an error.
     * @fires IDBRequest#onabort
     * @fires IDBRequest#onerror
     * @listens IDBRequest#onabort
     * @listens IDBRequest#onerror
     */
    request.onabort = request.onerror = () => reject(request.error);
  });
}



/**
 * !MODIFIED
 * I modified an original function (from the original library) and added some additional functionalities!
 * Added 'dbOptions' and 'upgradeCallback'.
 * 
 * 
 * Create a store in the specified IndexedDB database.
 *
 * @param {string} dbName - The name of the IndexedDB database.
 * @param {string} storeName - The name of the object store to create.
 * @param {object|null} [dbOptions=null] - Optional configuration options for the object store.
 * @param {function|null} [upgradeCallback=null] - Optional callback function for database upgrade actions.
 * @returns {function} A function that takes a transaction mode and a callback,
 *                     and returns a promise that resolves with the result of the callback.
 * @throws {Error} Throws an error if `dbOptions` is specified but not an object.
 */
export function createStore(dbName, storeName, dbOptions = null, upgradeCallback = null) {
  /**
   * Open a database.
   * @type {IDBOpenDBRequest}
   * @fires IDBOpenDBRequest#upgradeneeded
   * 
   * 
   * An asynchronous operation.
   * 'open' method returns an 'IDBOpenDBRequest' object (which will be assigned to the 'request' constant).
   * 
   * Events associated with 'IDBOpenDBRequest':
   * 'onsuccess': Fired when the database is successfully opened. The 'request.result' will be the 'IDBDatabase' instance.
   * 
   * 'onerror': Fired when there is an error opening the database.
   * 
   * 'onupgradeneeded': Fired when a new version of the database is creted or when an upgrade is needed. This is where are object stores typically created or modified.
   * This event is handled as part of the initial 'indexedDB.open' request.
   */
  const request = indexedDB.open(dbName);

  /**
   * Create an object store if it doesn't exist, or upgrade it.
   * @param {IDBVersionChangeEvent} event - The 'upgradeneeded' event object.
   * @throws {Error} Throws an error if `dbOptions` is specified but not an object.
   * 
   * 
   * This event is handled as part of the initial 'indexedDB.open' request.
   * It runs synchronously to ensure that any necessary schema updates are completed before database is opened.
   * Thus it runs before 'onsuccess'. 
   * The promise created by 'promisifyRequest' will only resolve once the database is fully opened and any necessary upgrades have been completed.
   * Once the upgrade process is complete, the 'onsuccess' event is fired, resolving the promise.
   */
  request.onupgradeneeded = (event) => {
    /**
     * Access the 'IDBDatabase' instance, representing the operend database.
     * @type {IDBDatabase}
     */
    const dataBase = event.target.result;

    /**
     * Check whether the specified object store exists.
     * If it doesn't exist, creates a new one with optional parameters.
     */
    if (!dataBase.objectStoreNames.contains(storeName)) {
      /**
       * If `dbOptions` is provided and is not an object, throw an error.
       */
      if (dbOptions && !Object.is(dbOptions)) {
        throw new Error(`Error during creating an object store in IndexedDB: Object store parameters must have an object format!`)
      }
      dataBase.createObjectStore(storeName, dbOptions);
    }

  /**
   * Invoke a custom upgrade callback function if provided.
   * @param {IDBDatabase} dataBase - The 'IDBDatabase' instance passed to the callback.
   */
    if (upgradeCallback && typeof upgradeCallback === 'function') {
      upgradeCallback(dataBase);
    }
  }

  /**
   * Convert IndexedDB request into a promise for easier async handling.
   * @type {Promise<IDBDatabase>}
   * 
   * 'indexedDB.open(dbName)' initiates asynchronous request to open a database. The 'request' object (which is an instance of 'IDBOpenDBRequest') is returned immediately, but the actual opening of the database happens asynchronously.
   */
  const dataBasePromise = promisifyRequest(request);


  /**
   * @param {IDBTransactionMode} transactionMode - The transaction mode ('readonly' or 'readwrite').
   * @param {function} callback - Callback function to perform operations on the object store.
   * @returns {Promise<any>} A promise that resolves with the result of the callback.
   * Returns an anonymous asynchronous function that provides a convinient way to interact with an IndexedDB database and its object stores in a structured manner.
   */
  return async (transactionMode, callback) => {
    /**
     * Waits for the IndexedDB database ('dataBasePromise') to open and become available.
     * @type {IDBDatabase}
     */
    const dataBase = await dataBasePromise;
    /**
     * A transaction is created on the database.
     * @type {IDBTransaction}
     * 
     * A transaction groups one or more operations into a single unit, ensuring that all operations either succeed or fail.
     * 
     * Transactions have modes such as '"readonly"' or '"readwrite"' which define the type of operations that can be performed within the transaction.
     * 
     * Transactions ensure that operations on the object store are isolated from other transactions. 
     * This means that no other transactions can interfere with the operations in the current transaction.
     */
    const transaction = dataBase.transaction(storeName, transactionMode);
    /**
     * Retrieve an object store by name ('storename').
     * @type {IDBObjectStore}
     * 
     * An object store holds the data records that we might want to work with.
     * 
     * An object store is where the data is actually stored in IndexedDB. Each object store can hold multiple records and each record has a key that uniquely identifies it.
     */
    const store = transaction.objectStore(storeName);
    /**
     * Call the provided 'callback' function and perform operations on an object store ('store') such as adding, updating, deleting or querying data within the object store.
     * 
     * Return the result of the callback. It might be useful to chain additional operations.
     * 
     * @type {any}
     */
    return callback(store);
  }
}



/**
 * Retrieves a read-only value from the IndexedDB store using the specified key.
 * 
 * Getting operation is promisified, because all IndexedDB methods are asynchronous and Promises help to work with them efficiently (e.g. better error handling - otherwise async functionality errors might be silent).
 * 
 * So the function immediately returns a Promise object and if it is resolved, it returns the result, if rejected - an error message.
 *
 * @param {IDBValidKey} key - The key to retrieve the value for.
 * @param {Function} customStore - A function that takes a mode ('readOnly' or 'readWrite') and a callback. The callback is executed with the store object.
 * @returns {Promise<any>} A promise that resolves with the retrieved value.
 */
export function get(key, customStore) {
  return customStore('readonly', store => promisifyRequest(store.get(key)));
}



/**
 * Set a readable and writable value with a key.
 * 
 * Setting operation is promisified, because all IndexedDB methods are asynchronous and Promises help to work with them efficiently (e.g. better error handling - otherwise async functionality errors might be silent).
 * 
 * In case of 'put' method, the first argument is the value, and the second one is the key.
 * 
 * 
 * 'promisifyRequest(store.transaction)' ensures that the entire transaction completes successfully before resolving the promise.
 * Transaction itself is asynchronous.
 * 'store.transaction' refers to the 'IDBTransaction' object associated with the object store operations being performed.
 * When we do operations (like 'get', 'put', 'delete', etc.) on an 'IDBObjectStore', these operations are always done within the context of an 'IDBTransaction'. 
 * The 'transaction' property of an 'IDBObjectStore' provides a reference to this transaction.
 * The 'IDBTransaction' ensures that a series of operations within the transaction are treated as a single unit. Either all operations succeed, or none do. If any operation fails, the transaction is rolled back.
 * Promisifying the transaction is essential for ensuring that we are aware when the transaction as a whole is complete.
 *
 * @param {IDBValidKey} key - Key to set the value.
 * @param {any} value - Value to set.
 * @param {Function} customStore - A function that takes a mode ('readOnly' or 'readWrite') and a callback. The callback is executed with the store object.
 * @returns {Promise<void>} - Promise that resolves when the value is set.
 */
export function set(key, value, customStore) {
  return customStore('readwrite', store => {
    store.put(value, key);
    return promisifyRequest(store.transaction);
  })
}



/**
 * Set multiple values at once. This is faster than calling set() multiple times.
 * It's also atomic – if one of the pairs can't be added, none will be added.
 * 
 * 
 * 'promisifyRequest(store.transaction)' ensures that the entire transaction completes successfully before resolving the promise.
 * Transaction itself is asynchronous.
 * 'store.transaction' refers to the 'IDBTransaction' object associated with the object store operations being performed.
 * When we do operations (like 'get', 'put', 'delete', etc.) on an 'IDBObjectStore', these operations are always done within the context of an 'IDBTransaction'. 
 * The 'transaction' property of an 'IDBObjectStore' provides a reference to this transaction.
 * The 'IDBTransaction' ensures that a series of operations within the transaction are treated as a single unit. Either all operations succeed, or none do. If any operation fails, the transaction is rolled back.
 * Promisifying the transaction is essential for ensuring that we are aware when the transaction as a whole is complete.
 *
 * 
 * @param {[IDBValidKey, any][]} entries - Array of entries, where each entry is an array of `[key, value]`.
 *  @param {Function} customStore - A function that takes a mode ('readOnly' or 'readWrite') and a callback. The callback is executed with the store object.
 * @returns {Promise<void>} - Promise that resolves when all values are set.
 */
export function setMany(entries, customStore) {
  return customStore('readwrite', store => {
    entries.forEach(entry => store.put(entry[1], entry[0]));
    return promisifyRequest(store.transaction);
  });
}



/**
 * Get multiple values by their keys.
 * 
 * Promise.all takes an array of promises and returns a single promise that resolves when all the promises in the array resolve, or rejects, if any of the promises in the array reject.
 * 
 * Array of Promises is created by mapping each Key in an Key array and promisifying the get request.
 * 
 * 'customStore('readonly', store => { ... })' initiates a readonly transaction.
 * The 'store' object represents the object store within this transaction.
 * Inside this transaction we perform necessary operations.
 * This process doesn't need to wait for the entire transaction to complete, because the operations involved are read-only and can be resolved individually as soon as each 'get' request completes.
 * Since no data is being modified, there's no need to ensure that multiple operations within the transaction succeed or fail together.
 * 
 *
 * @param {IDBValidKey[]} keys - An array of keys to retrieve from the store.
 * @param {Function} customStore - A function that takes a mode ('readOnly' or 'readWrite') and a callback. The callback is executed with the store object.
 * @returns {Promise<Array>} - A promise that resolves to an array of values corresponding to the provided keys.
 */
export function getMany(keys, customStore) {
  return customStore('readOnly', store => {
    return Promise.all(keys.map(key => promisifyRequest(store.get(key))));
  })
}



/**
 * Updates a value in the IndexedDB store using the specified key and an updater callback function.
 * 
 * The update operation is wrapped in a Promise for asynchronous handling. IndexedDB operations are asynchronous, and Promises help manage them effectively, ensuring proper error handling.
 * 
 * @param {IDBValidKey} key - The key to update the value for.
 * @param {Function} updaterCallback - A callback function that receives the current value from IndexedDB and returns the updated value.
 * @param {Function} customStore - A function that takes a mode ('readOnly' or 'readWrite') and a callback. The callback is executed with the store object.
 * @returns {Promise<void>} - A promise that resolves when the update operation completes successfully.
 */
export function update(key, updaterCallback, customStore) {
  return customStore('readwrite', store => {
    return new Promise((resolve, reject) => {
      /**
       * Sets up an event handler for the 'onsuccess' event of an 'IDBRequest' object which is returned by 'store.get(key)' call.
       * 
       * It is important NOT to use an arrow function to keep correct 'this' context. Otherwise, we should retrieve the 'result' like this: 'event.target.result'.
       * 
       * In our case, 'this' refers to an event target, which is the object that triggered the event - 'IDBRequest' object.
       */
      store.get(key).onsuccess = function() {
        try {
          /**
           * 'this.result' refers to the result of 'get' request - the value retrueved from the object store associated with the specific 'key'.
           * 
           * 'put' method either adds a new key-value pair if specified key doesn't exist, or updates the value if the key exists.
           * 
           * 
           * customStore('readwrite', store => { ... })' initiates a readwrite transaction.
           * The 'store' object represents the object store within this transaction.
           * Inside this transaction we perform necessary operations.
           * 'store.transaction' works as marking point. 
           * 'resolve(promisifyRequest(store.transaction))' call ensures that the promise resolves only when the transaction successfully completes.
           */
          store.put(updaterCallback(this.result), key);
          resolve(promisifyRequest(store.transaction));
        } catch(error) {
          reject(error);
        }
      }
    });
  });
}



/**
 * Delete a particular key from the store.
 * 
 * customStore('readwrite', store => { ... })' initiates a readwrite transaction.
 * The 'store' object represents the object store within this transaction.
 * Inside this transaction we perform necessary operations.
 * 'store.transaction' works as marking point. 
 * 'promisifyRequest(store.transaction)' call ensures that the promise resolves only when the transaction successfully completes.
 *
 * @param {IDBValidKey} key - Key to delete from the store.
 * @param {Function} customStore - A function that takes a mode ('readOnly' or 'readWrite') and a callback. The callback is executed with the store object.
 * @returns {Promise<void>} - Promise that resolves when the key is deleted.
 */
export function del(key, customStore) {
  return customStore('readwrite', store => {
    store.delete(key);
    return promisifyRequest(store.transaction);
  })
}



/**
 * Delete multiple keys at once.
 * 
 * customStore('readwrite', store => { ... })' initiates a readwrite transaction.
 * The 'store' object represents the object store within this transaction.
 * Inside this transaction we perform necessary operations.
 * 'store.transaction' works as marking point. 
 * 'promisifyRequest(store.transaction)' call ensures that the promise resolves only when the transaction successfully completes.
 *
 * @param {IDBValidKey[]} keys - List of keys to delete.
 * @param {Function} customStore - A function that takes a mode ('readOnly' or 'readWrite') and a callback. The callback is executed with the store object.
 * @returns {Promise<void>} - Promise that resolves when all keys are deleted.
 */
export function delMany(keys, customStore) {
  return customStore('readwrite', store => {
    keys.forEach(key => store.delete(key));
    return promisifyRequest(store.transaction);
  });
}



/**
 * Clear all values in the store.
 * 
 * customStore('readwrite', store => { ... })' initiates a readwrite transaction.
 * The 'store' object represents the object store within this transaction.
 * Inside this transaction we perform necessary operations.
 * 'store.transaction' works as marking point. 
 * 'promisifyRequest(store.transaction)' call ensures that the promise resolves only when the transaction successfully completes.
 *
 * @param {Function} customStore - A function that takes a mode ('readOnly' or 'readWrite') and a callback. The callback is executed with the store object.
 * @returns {Promise<void>} - Promise that resolves when the store is cleared.
 */
export function clear(customStore) {
  return customStore('readwrite', store => {
    store.clear();
    return promisifyRequest(store.transaction);
  });
}



/**
 * Helper function to iterate over cursor results.
 * 
 * Cursor provides a way to iterate over the records sequentially.
 * 'openCursor()' initiates a cursor operation and allows us to handle each record as it becomes available.
 * As the cursor iterates through each record, the 'onsuccess' event of the cursor's request ('IDBRequest') is triggered. And inside 'onsuccess' we can access the current record ('this.result') and perform operations on it.
 * When 'this.result' becomes 'null', it indicates that there are no more records to iterate over and cursor iteration stops.
 * 
 * 
 *  'store.openCursor().onsuccess = function() { ... })' initiates a readwrite transaction.
 * The 'store' object represents the object store within this transaction.
 * Inside this transaction we perform necessary operations.
 * 'store.transaction' works as marking point. 
 * 'promisifyRequest(store.transaction)' call ensures that the promise resolves only when the transaction successfully completes.
 *
 * @param {IDBObjectStore} store - The object store to iterate over.
 * @param {(cursor: IDBCursorWithValue) => void} callback - Callback function to handle each cursor result.
 * @returns {Promise<void>} - Promise that resolves when the iteration completes.
 */
function eachCursor(store, callback) {
  store.openCursor().onsuccess = function() {
    /**
     * Base case to stop the iteration when there is no more record.
     */
    if (!this.result) return;
    /**
     * Handles each record.
     */
    callback(this.result);
    /**
     * Moves to the next record.
     */
    this.result.continue();
  };
  return promisifyRequest(store.transaction);
}



/**
 * Retrieves all keys from the IndexedDB store using the provided custom store function.
 * 
 * This function initiates a read-only transaction on the IndexedDB store.
 * If available, it uses the modern IndexedDB method 'getAllKeys()' to fetch all keys asynchronously.
 * For older browsers without 'getAllKeys()', it iterates over each record in the store using the 'eachCursor' helper function.
 * 
 * @param {Function} customStore - A function that takes a mode ('readOnly' or 'readWrite') and a callback. The callback is executed with the store object.
 * @returns {Promise<Array>} A promise that resolves with an array of keys retrieved from the IndexedDB store.
 */
export function keys(customStore) {
  return customStore('readonly', async store => {
    /**
     * Fast path for modern browsers.
     * This method fetches all keys asynchronously and returns a promise that resolves with an array of keys.
     */
    if (store.getAllKeys) {
      return promisifyRequest(store.getAllKeys());
    }
    /**
     * Fallback for Older Browsers.
     * Uses 'eachCursor' helper function to iterate over each record in the 'store'.
     * For each cursor result, it pushes the 'cursor.key' (which represents the primary key of the record) into the items array.
     * After iterating through all records using 'eachCursor', it returns a promise ('eachCursor' returns a promise that resolves when the iteration completes). This promise resolvs to the 'items' array containing all keys retrieved from the object store.
     */
    const items = [];

    await eachCursor(store, cursor => items.push(cursor.key));

    return items;
  });
}



/**
 * Get all values in the store.
 *
 * @param {Function} customStore - A function that takes a mode ('readOnly' or 'readWrite') and a callback. The callback is executed with the store object.
 * @returns {Promise<Array>} - Promise that resolves with an array of values in the store.
 */
export function values(customStore) {
  return customStore('readonly', async store => {
    /**
     * Fast path for modern browsers.
     * This method fetches all values asynchronously and returns a promise that resolves with an array of values.
     */
    if (store.getAll) {
      return promisifyRequest(store.getAll());
    }
    /**
     * Fallback for Older Browsers.
     * Uses 'eachCursor' helper function to iterate over each record in the 'store'.
     * For each cursor result, it pushes the 'cursor.value' (which represents the primary key of the record) into the items array.
     * After iterating through all records using 'eachCursor', it returns a promise ('eachCursor' returns a promise that resolves when the iteration completes). This promise resolvs to the 'items' array containing all values retrieved from the object store.
     */
    const items = [];

    await eachCursor(store, cursor => items.push(cursor.value));
    return items;
  });
}



/**
 * Get all entries in the store. Each entry is an array of `[key, value]`.
 *
 * @param {Function} customStore - A function that takes a mode ('readOnly' or 'readWrite') and a callback. The callback is executed with the store object.
 * @returns {Promise<Array>} - Promise that resolves with an array of entries in the store.
 */
export function entries(customStore) {
  return customStore('readonly', async store => {
    /**
     * Fast path for modern browsers.
     * This method fetches all keys and values asynchronously and returns a promise that resolves with an array of entries.
     */
    if (store.getAll && store.getAllKeys) {
      const keys = await promisifyRequest(store.getAllKeys());
      const values = await promisifyRequest(store.getAll());
      return keys.map((key, i) => [key, values[i]]);
    }
    /**
     * Fallback for Older Browsers.
     * Uses 'eachCursor' helper function to iterate over each record in the 'store'.
     * For each cursor result, it pushes the [key, value] pair into the items array.
     * After iterating through all records using 'eachCursor', it returns a promise ('eachCursor' returns a promise that resolves when the iteration completes).
     * This promise resolves to the 'items' array containing all entries retrieved from the object store.
     */
    const items = [];
    await eachCursor(store, cursor => items.push([cursor.key, cursor.value]));
    return items;
  });
}