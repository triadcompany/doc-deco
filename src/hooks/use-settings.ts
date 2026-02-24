import { useState, useEffect, useCallback } from 'react';

export interface SettingsEntry {
  id: string;
  name: string;
  createdAt: string;
}

const STORAGE_KEY_AUTHORS = 'docvault_authors';
const STORAGE_KEY_TRANSLATORS = 'docvault_translators';

function loadFromStorage(key: string): SettingsEntry[] {
  try {
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

function saveToStorage(key: string, items: SettingsEntry[]) {
  localStorage.setItem(key, JSON.stringify(items));
}

export function useSettings() {
  const [authors, setAuthors] = useState<SettingsEntry[]>(() => loadFromStorage(STORAGE_KEY_AUTHORS));
  const [translators, setTranslators] = useState<SettingsEntry[]>(() => loadFromStorage(STORAGE_KEY_TRANSLATORS));

  useEffect(() => saveToStorage(STORAGE_KEY_AUTHORS, authors), [authors]);
  useEffect(() => saveToStorage(STORAGE_KEY_TRANSLATORS, translators), [translators]);

  const addAuthor = useCallback((name: string) => {
    const entry: SettingsEntry = {
      id: crypto.randomUUID(),
      name: name.trim(),
      createdAt: new Date().toISOString(),
    };
    setAuthors((prev) => [...prev, entry]);
  }, []);

  const removeAuthor = useCallback((id: string) => {
    setAuthors((prev) => prev.filter((a) => a.id !== id));
  }, []);

  const addTranslator = useCallback((name: string) => {
    const entry: SettingsEntry = {
      id: crypto.randomUUID(),
      name: name.trim(),
      createdAt: new Date().toISOString(),
    };
    setTranslators((prev) => [...prev, entry]);
  }, []);

  const removeTranslator = useCallback((id: string) => {
    setTranslators((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return {
    authors,
    translators,
    addAuthor,
    removeAuthor,
    addTranslator,
    removeTranslator,
  };
}
