let keyCount = 0;
let saveTimeout = null;

// 初期ロード：sync 優先、local はバックアップ
chrome.storage.sync.get(["keyCount"], (sync) => {
  if (sync.keyCount !== undefined) {
    keyCount = sync.keyCount;
  } else {
    chrome.storage.local.get(["keyCount"], (local) => {
      keyCount = local.keyCount || 0;
      chrome.storage.sync.set({ keyCount });
    });
  }
});

// メッセージ受信
chrome.runtime.onMessage.addListener((msg, sender) => {
  if (msg?.type === "updateKeyCount") {
    keyCount = msg.count;

    // 送信元タブを除外して全タブに送信
    chrome.tabs.query({}, (tabs) => {
      for (const tab of tabs) {
        if (sender.tab && tab.id === sender.tab.id) continue;
        chrome.tabs.sendMessage(tab.id, { type: "syncKeyCount", count: keyCount });
      }
    });

    // 保存（local + sync）
    if (saveTimeout) clearTimeout(saveTimeout);
    saveTimeout = setTimeout(() => {
      chrome.storage.local.set({ keyCount });
      chrome.storage.sync.set({ keyCount });
      saveTimeout = null;
    }, 300);

  } else if (msg?.type === "requestKeyCount") {
    // 初回ロード時のみ送信
    chrome.tabs.sendMessage(sender.tab.id, { type: "syncKeyCount", count: keyCount });
  }
});

// 他PCでの sync 変更監視
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "sync" && changes.keyCount) {
    keyCount = changes.keyCount.newValue;
    chrome.tabs.query({}, (tabs) => {
      for (const tab of tabs) {
        chrome.tabs.sendMessage(tab.id, { type: "syncKeyCount", count: keyCount });
      }
    });
    chrome.storage.local.set({ keyCount });
  }
});
