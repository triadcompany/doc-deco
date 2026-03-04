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

function createEntry(name: string): SettingsEntry {
  return {
    id: crypto.randomUUID(),
    name: name.trim(),
    createdAt: new Date().toISOString(),
  };
}

function mergeEntries(existing: SettingsEntry[], names: string[]) {
  const map = new Map(existing.map((entry) => [entry.name.trim().toLowerCase(), entry]));

  names
    .map((name) => name.trim())
    .filter(Boolean)
    .forEach((name) => {
      const key = name.toLowerCase();
      if (!map.has(key)) {
        map.set(key, createEntry(name));
      }
    });

  return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
}

export function useSettings(seedAuthors: string[] = [], seedTranslators: string[] = []) {
  const [authors, setAuthors] = useState<SettingsEntry[]>(() => mergeEntries(loadFromStorage(STORAGE_KEY_AUTHORS), seedAuthors));
  const [translators, setTranslators] = useState<SettingsEntry[]>(() => mergeEntries(loadFromStorage(STORAGE_KEY_TRANSLATORS), seedTranslators));

  useEffect(() => {
    setAuthors((prev) => mergeEntries(prev, seedAuthors));
  }, [seedAuthors]);

  useEffect(() => {
    setTranslators((prev) => mergeEntries(prev, seedTranslators));
  }, [seedTranslators]);

  useEffect(() => saveToStorage(STORAGE_KEY_AUTHORS, authors), [authors]);
  useEffect(() => saveToStorage(STORAGE_KEY_TRANSLATORS, translators), [translators]);

  const addAuthor = useCallback((name: string) => {
    setAuthors((prev) => mergeEntries(prev, [name]));
  }, []);

  const removeAuthor = useCallback((id: string) => {
    setAuthors((prev) => prev.filter((a) => a.id !== id));
  }, []);

  const addTranslator = useCallback((name: string) => {
    setTranslators((prev) => mergeEntries(prev, [name]));
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
