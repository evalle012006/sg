import storage from 'redux-persist/lib/storage';

const customStorage = {
  ...storage,
  setItem: (key, item) => {
    return new Promise((resolve, reject) => {
      storage.setItem(key, item).then(resolve).catch(error => {
        if (error instanceof DOMException && error.name === 'QuotaExceededError') {
          console.warn('Storage quota exceeded. Some state may not persist.');
          // Optionally, you could try to clear some data here
          // storage.removeItem('some_less_important_key').then(() => {
          //   storage.setItem(key, item).then(resolve).catch(reject);
          // }).catch(reject);
          resolve();
        } else {
          reject(error);
        }
      });
    });
  }
};

export default customStorage;